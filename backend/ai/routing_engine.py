"""
GeoAI Routing Engine — ties together the GNN models, RL agents,
NetworkX graph, and SUMO simulation into one callable interface
that the FastAPI endpoints will use.

Call flow for a dispatch request:
  1. Build/update RoadNetworkGraph from latest PostGIS data.
  2. Run GNN (GAT or PMGCN) to score every node → routing heat-map.
  3. ALT (A* with Landmarks and Triangle inequality) search on GNN-modulated
     edge costs finds the optimal route.
  4. Return route (WKT LINESTRING), ETA, and confidence score.
"""

from __future__ import annotations

import heapq
import logging
import time
from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any

import numpy as np
import torch

from .gnn_models import GAT, PMGCN, GraphSAGE
from .rl_agents import PPOAgent
from .graph_builder import RoadNetworkGraph
from .sumo_interface import SUMOInterface

logger = logging.getLogger(__name__)

# How much to penalise low-GNN-score roads relative to travel_time_s.
# Edge cost = travel_time_s * (1 + (1 - gnn_score) * GNN_PENALTY_WEIGHT)
# Range: [travel_time_s * 1.0,  travel_time_s * 1.5]
# Always >= travel_time_s, so landmark heuristics remain admissible.
GNN_PENALTY_WEIGHT: float = 0.5

# How much scheduled congestion inflates an edge's cost on the constraint path.
# Edge cost *= 1 + congestion * CONGESTION_WEIGHT, with congestion (derived from
# the GAT geojson's time-of-day traffic schedule) in [0, 1) → factor in
# [1.0, 3.0). Always >= 1.0, so the ALT landmark heuristic (precomputed on the
# un-congested "weight") stays admissible.
CONGESTION_WEIGHT: float = 2.0

# ── Scheduled congestion (replaces the deprecated SUMO live feed) ─────────────
# Each road in the GAT geojson carries a time-of-day traffic schedule. We fold
# that schedule into a per-edge congestion vector (one value per bucket below)
# at load time, then pick the bucket matching the current wall-clock at route
# time. No live data source needed.
_TRAFFIC_BUCKETS: Tuple[str, ...] = ("morning", "noon", "afternoon", "evening", "night")
_BUCKET_MINUTE_RANGES: Dict[str, List[Tuple[int, int]]] = {
    "morning":   [(6 * 60, 10 * 60)],   # 06:00–10:00
    "noon":      [(10 * 60, 14 * 60)],  # 10:00–14:00
    "afternoon": [(14 * 60, 18 * 60)],  # 14:00–18:00
    "evening":   [(18 * 60, 22 * 60)],  # 18:00–22:00
    "night":     [(22 * 60, 24 * 60), (0, 6 * 60)],  # 22:00–06:00 (wraps midnight)
}
# traffic_severity / school_*_severity (ordinal 0-3) → congestion in [0, 1).
# Capped below 1.0 so scheduled traffic heavily penalises but never hard-blocks
# a road — only blockades/floods (applied as inf weights) do that.
_SEVERITY_TO_CONGESTION: Dict[int, float] = {0: 0.0, 1: 0.4, 2: 0.7, 3: 0.95}
# A road flagged busy for a period but with no severity rating gets this.
_FLAGGED_BASE_CONGESTION: float = 0.4


def _bucket_index_for_hour(hour: int) -> int:
    """Map a 24h clock hour to its index in _TRAFFIC_BUCKETS."""
    minute = hour * 60
    for i, name in enumerate(_TRAFFIC_BUCKETS):
        for start, end in _BUCKET_MINUTE_RANGES[name]:
            if start <= minute < end:
                return i
    return _TRAFFIC_BUCKETS.index("night")


def _parse_hhmm(value: Any) -> Optional[int]:
    """Parse a 'HH:MM' string to minutes-since-midnight, else None."""
    if not value:
        return None
    try:
        h, m = str(value).split(":")
        return int(h) * 60 + int(m)
    except (ValueError, AttributeError):
        return None


def _buckets_for_window(start_min: int, end_min: int) -> set:
    """Return the set of bucket indices a [start, end] minute window overlaps."""
    # A window whose start >= end wraps past midnight.
    ranges = (
        [(start_min, 24 * 60), (0, end_min)]
        if start_min >= end_min
        else [(start_min, end_min)]
    )
    out: set = set()
    for i, name in enumerate(_TRAFFIC_BUCKETS):
        for bs, be in _BUCKET_MINUTE_RANGES[name]:
            for ws, we in ranges:
                if ws < be and bs < we:  # half-open overlap
                    out.add(i)
    return out


def _congestion_schedule_for_feature(props: Dict[str, Any]) -> List[float]:
    """
    Fold one road's time-of-day traffic fields into a per-bucket congestion
    vector aligned to _TRAFFIC_BUCKETS, each value in [0, 1).

    Combines three signals (taking the max in each bucket):
      1. binary traffic_<bucket> flags,
      2. explicit traffic_start/end_{1,2} windows, and
      3. school_<period>_severity ratings,
    each scaled by traffic_severity (or _FLAGGED_BASE_CONGESTION when a period
    is flagged busy but carries no severity).
    """
    vec = [0.0] * len(_TRAFFIC_BUCKETS)

    try:
        sev = int(props.get("traffic_severity") or 0)
    except (ValueError, TypeError):
        sev = 0
    sev_cong = _SEVERITY_TO_CONGESTION.get(sev, 0.0)
    active = sev_cong if sev_cong > 0 else _FLAGGED_BASE_CONGESTION

    # 1. Binary time-of-day flags → their own bucket.
    for i, name in enumerate(_TRAFFIC_BUCKETS):
        if props.get(f"traffic_{name}"):
            vec[i] = max(vec[i], active)

    # 2. Explicit traffic windows → every bucket they overlap.
    for s_key, e_key in (("traffic_start_1", "traffic_end_1"),
                         ("traffic_start_2", "traffic_end_2")):
        s = _parse_hhmm(props.get(s_key))
        e = _parse_hhmm(props.get(e_key))
        if s is None or e is None or s == e:
            continue
        for i in _buckets_for_window(s, e):
            vec[i] = max(vec[i], active)

    # 3. School-zone severities → their specific bucket.
    for name, key in (("morning", "school_morning_severity"),
                      ("noon", "school_noon_severity"),
                      ("afternoon", "school_afternoon_severity")):
        try:
            ssev = int(props.get(key) or 0)
        except (ValueError, TypeError):
            ssev = 0
        c = _SEVERITY_TO_CONGESTION.get(ssev, 0.0)
        if c > 0:
            vec[_TRAFFIC_BUCKETS.index(name)] = max(vec[_TRAFFIC_BUCKETS.index(name)], c)

    return vec


NUM_LANDMARKS: int = 16   # number of ALT landmark nodes
PENALTY_FACTOR: float = 3.0  # edge cost multiplier after each route is found

OBSTRUCTION_RADIUS_KM: float = 0.05   # 50m — edges with both endpoints within this radius are affected
OBSTRUCTION_SEVERITY: Dict[str, float] = {
    "blockade":  float("inf"),   # fully blocked
    "flood":     float("inf"),   # impassable
    "repair":    5.0,            # 5x slower
    "accident":  8.0,            # 8x slower
}


class GeoAIRoutingEngine:

    def __init__(
        self,
        gnn_type: str = "gat",
        use_rl: bool = True,
        use_sumo: bool = False,
        gnn_model_path: Optional[str] = None,
        rl_model_path: Optional[str] = None,
        sumo_kwargs: Optional[Dict] = None,
        in_channels: int = 7,
        hidden_channels: int = 64,
        out_channels: int = 16,
        device: str = "cpu",
    ):
        self.device = torch.device(device)
        self.use_rl = use_rl
        self.use_sumo = use_sumo

        self._precomputed_weights = False  # set True after apply_edge_weights()
        self._use_constraint_costs = False  # set True after apply_predicted_constraints()

        # Per-edge time-of-day congestion vectors (one float per _TRAFFIC_BUCKETS
        # entry), built from the GAT geojson traffic schedule in
        # apply_predicted_constraints and read live in apply_congestion.
        self._edge_congestion_schedule: Dict[Tuple[int, int], List[float]] = {}

        # Cached (edge_costs, node_scores_map) from the active cost source. The
        # graph sweep that builds these only changes when edge weights change, so
        # we hold the result and invalidate it in invalidate_landmarks() (the
        # single chokepoint every weight-mutating method already calls).
        self._edge_cost_cache: "Tuple[Dict[Tuple[int, int], float], Dict[int, float]] | None" = None

        # ── GNN model ─────────────────────────────────────────────────────────
        if gnn_type == "pmgcn":
            self.gnn = PMGCN(
                in_channels=in_channels,
                hidden_channels=hidden_channels,
                task_out_channels=out_channels,
            ).to(self.device)
        elif gnn_type == "graphsage":
            self.gnn = GraphSAGE(
                in_channels=in_channels,
                hidden_channels=hidden_channels,
                out_channels=out_channels,
            ).to(self.device)
        else:
            self.gnn = GAT(
                in_channels=in_channels,
                hidden_channels=hidden_channels,
                out_channels=out_channels,
            ).to(self.device)

        if gnn_model_path:
            self._load_gnn(gnn_model_path)
        self.gnn.eval()

        # ── RL agent (PPO) ────────────────────────────────────────────────────
        self.rl_agent: Optional[PPOAgent] = None
        if use_rl:
            self.rl_agent = PPOAgent(model_path=rl_model_path or "checkpoints/ppo_dispatch")
            if rl_model_path:
                try:
                    self.rl_agent.load()
                    logger.info("PPO agent loaded from %s", rl_model_path)
                except Exception as exc:
                    logger.warning("PPO load failed (%s) — running without trained RL weights.", exc)

        # ── SUMO interface ────────────────────────────────────────────────────
        self.sumo: Optional[SUMOInterface] = None
        if use_sumo:
            self.sumo = SUMOInterface(**(sumo_kwargs or {}))
            try:
                self.sumo.start()
                logger.info("SUMO simulation connected.")
            except Exception as exc:
                logger.warning("SUMO start failed (%s) — falling back to static routing.", exc)
                self.sumo = None

        # ── Road network graph ────────────────────────────────────────────────
        self.graph = RoadNetworkGraph()

        # ── ALT landmark state ────────────────────────────────────────────────
        self._landmark_nodes: List[int] = []
        self._landmark_dists: Dict[int, Dict[int, float]] = {}      # lm → {node: dist}
        self._landmark_dists_rev: Dict[int, Dict[int, float]] = {}  # lm → {node: dist} (reversed)
        self._landmarks_valid: bool = False

    # ── GNN helpers ───────────────────────────────────────────────────────────

    def _load_gnn(self, path: str):
        state = torch.load(path, map_location=self.device, weights_only=True)
        self.gnn.load_state_dict(state)
        logger.info("GNN weights loaded from %s", path)

    def apply_edge_weights(self, weights: dict):
        """
        Apply precomputed GNN edge weights to graph edges.

        weights: dict mapping "u_v_0" (OSM node pair) → float score.
        Higher score = better road = lower Dijkstra cost.
        Modulates travel_time by a factor in [0.6, 1.0].
        """
        if not weights:
            return
        vals = list(weights.values())
        min_w, max_w = min(vals), max(vals)
        spread = max_w - min_w or 1e-6

        applied = 0
        for u, v, data in self.graph.G.edges(data=True):
            key = f"{u}_{v}_0"
            if key in weights:
                w = weights[key]
                factor = 1.0 - 0.4 * (w - min_w) / spread  # [0.6, 1.0]
                data["weight"] = data.get("travel_time_s", 60.0) * factor
                applied += 1

        self._precomputed_weights = True
        self.invalidate_landmarks()
        logger.info(
            "GraphSAGE edge weights applied: %d / %d edges covered",
            applied, self.graph.G.number_of_edges(),
        )

    def apply_predicted_constraints(
        self,
        features: List[Dict[str, Any]],
        multiplier_by_type: Optional[Dict[str, float]] = None,
    ) -> None:
        """
        Apply GAT-predicted per-road constraints to the routing graph.

        Each feature is a road segment whose geometry matches a road in the
        graph (built from roads_panabo.gpkg). For every consecutive coordinate
        pair we look up the graph edge by snapped (lon, lat) and set:

            edge["weight"]              = travel_time_s * routing_multiplier
            edge["routing_multiplier"]  = routing_multiplier

        The per-road multiplier is resolved in this order:
          1. the feature's own ``routing_multiplier`` property (if present);
          2. ``multiplier_by_type[routing_constraint_type]`` (falling back to
             ``display_constraint_type``) — used when the export only carries a
             constraint *type* and the multipliers live in the style config.

        Fully blocked segments (is_blocked == 1) get an infinite weight so the
        ALT search never traverses them. Because routing_multiplier >= 1.0,
        weight >= travel_time_s, keeping the ALT landmark heuristic admissible.

        After this call, route computations use these per-edge costs instead of
        the live GNN forward pass (see _compute_constraint_edge_costs).
        """
        if not features:
            return

        mult_by_type = multiplier_by_type or {}

        # Rebuilt from scratch on every (re)load so stale schedules don't linger.
        self._edge_congestion_schedule = {}

        SNAP = 6  # must match qgis_loader.load_roads_gpkg SNAP_DECIMALS

        # Build a (lon, lat) → node_id lookup from current graph nodes.
        coord_to_node: Dict[Tuple[float, float], int] = {}
        for n, nd in self.graph.G.nodes(data=True):
            coord_to_node[(round(nd["lon"], SNAP), round(nd["lat"], SNAP))] = n

        def _edge_pair(lon1, lat1, lon2, lat2):
            u = coord_to_node.get((round(lon1, SNAP), round(lat1, SNAP)))
            v = coord_to_node.get((round(lon2, SNAP), round(lat2, SNAP)))
            return u, v

        applied = 0
        for feat in features:
            props = feat.get("properties", {})
            geom = feat.get("geometry") or {}
            if geom.get("type") != "LineString":
                continue

            mult = props.get("routing_multiplier")
            if mult is None:
                ctype = props.get("routing_constraint_type") or props.get(
                    "display_constraint_type"
                )
                mult = mult_by_type.get(ctype, 1.0)
            try:
                mult = float(mult or 1.0)
            except (TypeError, ValueError):
                mult = 1.0

            blocked = bool(props.get("is_blocked", 0))
            coords = geom.get("coordinates", [])

            # Time-of-day congestion schedule for this road (skipped when blocked,
            # since an inf-weight edge is never traversed anyway).
            cong_vec = None if blocked else _congestion_schedule_for_feature(props)
            has_cong = bool(cong_vec) and any(cong_vec)

            for i in range(len(coords) - 1):
                lon1, lat1 = coords[i][0], coords[i][1]
                lon2, lat2 = coords[i + 1][0], coords[i + 1][1]
                u, v = _edge_pair(lon1, lat1, lon2, lat2)
                if u is None or v is None:
                    continue
                # roads_panabo edges are bidirectional → update both directions
                for a, b in ((u, v), (v, u)):
                    if not self.graph.G.has_edge(a, b):
                        continue
                    data = self.graph.G[a][b]
                    base = data.get("travel_time_s", 60.0)
                    data["routing_multiplier"] = mult
                    data["weight"] = float("inf") if blocked else base * mult
                    applied += 1

                    if has_cong:
                        cur = self._edge_congestion_schedule.get((a, b))
                        if cur is None:
                            self._edge_congestion_schedule[(a, b)] = list(cong_vec)
                        else:
                            for k in range(len(cur)):
                                if cong_vec[k] > cur[k]:
                                    cur[k] = cong_vec[k]

        self._precomputed_weights = True
        self._use_constraint_costs = True
        self.invalidate_landmarks()
        logger.info(
            "GAT constraint multipliers applied: %d edge-directions over %d features "
            "(graph has %d edges)",
            applied, len(features), self.graph.G.number_of_edges(),
        )

    def _compute_constraint_edge_costs(
        self,
    ) -> Tuple[Dict[Tuple[int, int], float], Dict[int, float]]:
        """
        Build per-edge costs from the GAT routing multipliers stored on the
        graph (see apply_predicted_constraints), replacing the live GNN.

        Edge cost = the precomputed edge["weight"] (= travel_time_s * multiplier,
        or inf when blocked). node_scores_map carries a routing "goodness" in
        [0, 1] (1 / multiplier) per node, used only for the confidence metric.
        """
        edge_costs: Dict[Tuple[int, int], float] = {}
        node_mult_acc: Dict[int, List[float]] = {}

        for u, v, data in self.graph.G.edges(data=True):
            base = data.get("travel_time_s", 60.0)
            cost = data.get("weight", base)
            edge_costs[(u, v)] = cost
            mult = float(data.get("routing_multiplier", 1.0) or 1.0)
            node_mult_acc.setdefault(u, []).append(mult)
            node_mult_acc.setdefault(v, []).append(mult)

        node_scores_map: Dict[int, float] = {}
        for n in self.graph.G.nodes():
            mults = node_mult_acc.get(n)
            avg = (sum(mults) / len(mults)) if mults else 1.0
            node_scores_map[n] = 1.0 / avg if avg > 0 else 1.0

        return edge_costs, node_scores_map

    def apply_obstructions(
        self,
        obstructions: List[Dict[str, Any]],
        edge_costs: Dict[Tuple[int, int], float],
    ) -> Dict[Tuple[int, int], float]:
        """
        Overlay obstruction penalties onto an existing edge-cost dict.

        For each obstruction, find graph edges whose midpoint is within
        OBSTRUCTION_RADIUS_KM. Multiply their cost by the severity factor
        (or set to inf for full blocks).

        Returns the mutated edge_costs dict (same object, modified in place).
        """
        if not obstructions:
            return edge_costs

        from .graph_builder import _haversine_km

        affected = 0
        for obs in obstructions:
            olat, olon = obs["latitude"], obs["longitude"]
            severity = OBSTRUCTION_SEVERITY.get(obs.get("type", "repair"), 5.0)

            for u, v, data in self.graph.G.edges(data=True):
                u_data = self.graph.G.nodes[u]
                v_data = self.graph.G.nodes[v]
                mid_lat = (u_data["lat"] + v_data["lat"]) / 2
                mid_lon = (u_data["lon"] + v_data["lon"]) / 2
                dist = _haversine_km(olat, olon, mid_lat, mid_lon)

                if dist <= OBSTRUCTION_RADIUS_KM:
                    current = edge_costs.get(
                        (u, v), data.get("weight", data.get("travel_time_s", 60.0))
                    )
                    if severity == float("inf"):
                        edge_costs[(u, v)] = float("inf")
                    else:
                        edge_costs[(u, v)] = current * severity
                    affected += 1

        if affected:
            logger.info(
                "Obstructions: %d active, %d edge-costs modified",
                len(obstructions), affected,
            )
        return edge_costs

    def apply_congestion(
        self,
        edge_costs: Dict[Tuple[int, int], float],
        now: Optional[datetime] = None,
    ) -> Dict[Tuple[int, int], float]:
        """
        Overlay scheduled time-of-day congestion onto an existing edge-cost dict.

        Congestion comes from each road's traffic schedule in the GAT geojson,
        folded into per-edge per-bucket vectors at load time (see
        _edge_congestion_schedule / _congestion_schedule_for_feature). For the
        bucket matching ``now`` (defaults to the current wall-clock), each edge's
        cost is scaled by (1 + congestion * CONGESTION_WEIGHT), so roads that are
        busy at this hour cost proportionally more. This replaces the deprecated
        SUMO live feed — no external data source is required.

        Applied as a fresh per-route overlay (not baked into the cached constraint
        costs) so the penalty tracks the clock without busting the static cache.
        Because the factor is >= 1.0 the ALT landmark heuristic stays admissible.

        Returns the mutated edge_costs dict (same object, modified in place).
        """
        if not self._edge_congestion_schedule:
            return edge_costs

        now = now or datetime.now()
        bucket = _bucket_index_for_hour(now.hour)

        affected = 0
        for (u, v), vec in self._edge_congestion_schedule.items():
            congestion = vec[bucket]
            if congestion <= 0.0:
                continue
            current = edge_costs.get((u, v))
            if current is None or current == float("inf"):
                continue
            edge_costs[(u, v)] = current * (1.0 + congestion * CONGESTION_WEIGHT)
            affected += 1

        if affected:
            logger.info(
                "Congestion [%s]: %d edge-costs inflated (CONGESTION_WEIGHT=%.1f)",
                _TRAFFIC_BUCKETS[bucket], affected, CONGESTION_WEIGHT,
            )
        return edge_costs

    def _run_gnn(self, data) -> torch.Tensor:
        """Run GNN forward pass and return node embeddings / scores."""
        x = data.x.to(self.device)
        edge_index = data.edge_index.to(self.device)
        with torch.no_grad():
            if isinstance(self.gnn, PMGCN):
                scores, _ = self.gnn(x, edge_index)
            else:
                scores = self.gnn(x, edge_index)
        return scores  # shape: [num_nodes, out_channels]

    # ── Congestion update ─────────────────────────────────────────────────────

    def _update_congestion_from_sumo(self):
        """Pull live congestion from SUMO and apply to graph nodes."""
        if self.sumo is None or not self.sumo.is_connected:
            return
        try:
            self.sumo.step()
            congestion_map = self.sumo.get_congestion_map()
            for edge_id, level in congestion_map.items():
                node_id = self._sumo_edge_to_node(edge_id)
                if node_id is not None:
                    self.graph.update_congestion(node_id, level)
        except Exception as exc:
            logger.warning("SUMO congestion update failed: %s", exc)

    def _sumo_edge_to_node(self, edge_id: str) -> Optional[int]:
        """Map a SUMO edge ID to a graph node ID. Override to suit your network."""
        try:
            return int(edge_id.split("_")[-1])
        except (ValueError, IndexError):
            return None

    # ── ALT landmark preprocessing ────────────────────────────────────────────

    def invalidate_landmarks(self):
        """Mark landmark cache as stale. Call after topology or weight changes."""
        self._landmarks_valid = False
        # Edge costs derive from the same weights as landmarks, so any change
        # that stales landmarks also stales the cached edge-cost dict.
        self._edge_cost_cache = None

    def _precompute_landmarks(self, num_landmarks: int = NUM_LANDMARKS) -> None:
        """
        Select landmark nodes with farthest-point selection and precompute
        shortest-path distances from/to each landmark using the base "weight"
        edge attribute (= travel_time_s at graph-build time).

        Because per-query GNN costs are always >= travel_time_s (penalty
        factor is in [1.0, 1.5]), these distances are valid admissible lower
        bounds for every ALT query.
        """
        import networkx as nx

        G = self.graph.G
        nodes = list(G.nodes())
        if len(nodes) < 2:
            logger.warning("Graph too small for landmark precomputation (%d nodes)", len(nodes))
            self._landmarks_valid = False
            return

        t0 = time.perf_counter()
        actual_k = min(num_landmarks, len(nodes))

        # ── Farthest-point landmark selection ─────────────────────────────────
        # Seed with a Dijkstra from nodes[0] to find the true farthest node.
        d0 = nx.single_source_dijkstra_path_length(G, nodes[0], weight="weight")
        first_lm = max(nodes, key=lambda v: d0.get(v, 0.0))

        landmarks: List[int] = [first_lm]
        fwd: Dict[int, Dict[int, float]] = {
            first_lm: dict(nx.single_source_dijkstra_path_length(G, first_lm, weight="weight"))
        }
        # min_dist[v] = distance from v to its nearest landmark so far
        min_dist: Dict[int, float] = {v: fwd[first_lm].get(v, float("inf")) for v in nodes}

        while len(landmarks) < actual_k:
            # The node farthest from all current landmarks becomes the next one
            next_lm = max(
                (v for v in nodes if v not in landmarks),
                key=lambda v: min_dist.get(v, 0.0),
                default=None,
            )
            if next_lm is None:
                break
            landmarks.append(next_lm)
            d = dict(nx.single_source_dijkstra_path_length(G, next_lm, weight="weight"))
            fwd[next_lm] = d
            for v in nodes:
                min_dist[v] = min(min_dist[v], d.get(v, float("inf")))

        # ── Backward distances (Dijkstra on reversed graph) ───────────────────
        rev_G = G.reverse(copy=False)
        rev: Dict[int, Dict[int, float]] = {
            lm: dict(nx.single_source_dijkstra_path_length(rev_G, lm, weight="weight"))
            for lm in landmarks
        }

        self._landmark_nodes = landmarks
        self._landmark_dists = fwd
        self._landmark_dists_rev = rev
        self._landmarks_valid = True

        elapsed = (time.perf_counter() - t0) * 1000
        logger.info(
            "ALT: %d landmarks precomputed in %.1fms (graph: %d nodes, %d edges)",
            len(landmarks), elapsed, G.number_of_nodes(), G.number_of_edges(),
        )

    def _alt_heuristic(self, node: int, target: int) -> float:
        """
        Admissible lower-bound on cost(node → target) via the triangle inequality:

          For each landmark L:
            cost(n, t) >= dist(L, t) - dist(L, n)   [forward]
            cost(n, t) >= dist(n, L) - dist(t, L)   [backward]
        """
        h = 0.0
        for lm in self._landmark_nodes:
            d_L_n = self._landmark_dists[lm].get(node, float("inf"))
            d_L_t = self._landmark_dists[lm].get(target, float("inf"))
            if d_L_t < float("inf") and d_L_n < float("inf"):
                h = max(h, d_L_t - d_L_n)

            d_n_L = self._landmark_dists_rev[lm].get(node, float("inf"))
            d_t_L = self._landmark_dists_rev[lm].get(target, float("inf"))
            if d_n_L < float("inf") and d_t_L < float("inf"):
                h = max(h, d_n_L - d_t_L)
        return h

    # ── ALT search ────────────────────────────────────────────────────────────

    def _alt_search(
        self,
        source: int,
        target: int,
        weight_overrides: Optional[Dict[Tuple[int, int], float]] = None,
    ) -> Tuple[List[int], float]:
        """
        A* search guided by the ALT heuristic.

        weight_overrides: per-edge cost map; used to carry GNN modulation and
                          cumulative penalties across multi-route calls.
        Returns (route_nodes, total_cost).
        Raises ValueError if target is unreachable.
        """
        if source == target:
            return [source], 0.0

        G = self.graph.G
        node_features = self.graph._node_features

        def edge_cost(u: int, v: int) -> float:
            if weight_overrides and (u, v) in weight_overrides:
                return weight_overrides[(u, v)]
            data = G[u][v]
            return data.get("weight", data.get("travel_time_s", 60.0))

        h0 = self._alt_heuristic(source, target) if self._landmarks_valid else 0.0
        # heap entries: (f_score, g_score, node_id)
        heap: List[Tuple[float, float, int]] = [(h0, 0.0, source)]
        g_score: Dict[int, float] = {source: 0.0}
        came_from: Dict[int, int] = {}
        closed: set = set()

        while heap:
            _, g, node = heapq.heappop(heap)

            if node in closed:
                continue
            closed.add(node)

            if node == target:
                path: List[int] = []
                cur = target
                while cur != source:
                    path.append(cur)
                    cur = came_from[cur]
                path.append(source)
                path.reverse()
                return path, g

            for nb in G.successors(node):
                if nb in closed:
                    continue
                feats = node_features.get(nb)
                if feats is not None and feats[4] >= 1.0:
                    continue  # fully congested — impassable

                w = edge_cost(node, nb)
                new_g = g + w
                if new_g < g_score.get(nb, float("inf")):
                    g_score[nb] = new_g
                    came_from[nb] = node
                    h = self._alt_heuristic(nb, target) if self._landmarks_valid else 0.0
                    heapq.heappush(heap, (new_g + h, new_g, nb))

        raise ValueError(f"ALT search could not reach node {target} from {source}")

    # ── GNN edge cost computation ─────────────────────────────────────────────

    def _compute_gnn_edge_costs(
        self,
    ) -> Tuple[Dict[Tuple[int, int], float], Dict[int, float]]:
        """
        Run GNN forward pass and build per-edge costs.

        Edge cost = travel_time_s * (1 + (1 - gnn_score) * GNN_PENALTY_WEIGHT)
        Factor range: [1.0, 1.5] — always >= travel_time_s, keeping landmark
        heuristics admissible.

        Returns:
          edge_costs:      (u, v) → float
          node_scores_map: node_id → normalised GNN score in [0, 1]
        """
        pyg_data = self.graph.to_pyg()
        node_scores = self._run_gnn(pyg_data)
        raw = node_scores.norm(dim=-1).cpu().numpy()
        w_min, w_max = float(raw.min()), float(raw.max())
        spread = w_max - w_min if w_max > w_min else 1e-6
        norm = (raw - w_min) / spread

        nodes_sorted = sorted(self.graph._node_features.keys())
        node_to_idx = {n: i for i, n in enumerate(nodes_sorted)}
        node_scores_map: Dict[int, float] = {n: float(norm[i]) for n, i in node_to_idx.items()}

        edge_costs: Dict[Tuple[int, int], float] = {}
        for u, v, data in self.graph.G.edges(data=True):
            gnn_score = node_scores_map.get(u, 0.5)
            penalty = 1.0 + (1.0 - gnn_score) * GNN_PENALTY_WEIGHT
            edge_costs[(u, v)] = data.get("travel_time_s", 60.0) * penalty

        return edge_costs, node_scores_map

    def _compute_edge_costs(
        self,
    ) -> Tuple[Dict[Tuple[int, int], float], Dict[int, float]]:
        """
        Return per-edge costs and per-node scores from the active source:
        GAT-predicted constraint multipliers when loaded, else the live GNN.

        On the constraint path the costs only change when constraints are
        reloaded, so the result is cached and reused until invalidate_landmarks()
        clears it — repeated calls (e.g. the connector recomputed on every
        responder location ping) then skip the full-graph sweep. The live GNN
        path is NOT cached: it runs a fresh forward pass each call and reflects
        live SUMO congestion, so it must recompute every time.

        edge_costs is returned as a shallow copy because apply_obstructions
        mutates it in place; node_scores_map is read-only at every call site and
        is shared.
        """
        if not self._use_constraint_costs:
            return self._compute_gnn_edge_costs()

        if self._edge_cost_cache is None:
            self._edge_cost_cache = self._compute_constraint_edge_costs()
        cached_edge_costs, cached_node_scores = self._edge_cost_cache
        return dict(cached_edge_costs), cached_node_scores

    # ── Main routing API ──────────────────────────────────────────────────────

    def compute_route(
        self,
        source_node: int,
        target_node: int,
        obstructions: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Compute the optimal fire-response route using ALT (A* with Landmarks).

        Flow:
          1. Run GNN forward pass → per-edge cost modulation.
          2. Precompute landmarks if stale.
          3. ALT (A*) search on GNN-modulated edge costs.
          4. ETA is the sum of base travel_time_s values along the path.

        Returns a dict with:
          - route_nodes, eta_seconds, gnn_confidence, route_wkt, computation_ms
        """
        t0 = time.perf_counter()
        self._update_congestion_from_sumo()

        if self.graph.G.number_of_nodes() == 0:
            raise ValueError("Road network graph has no nodes.")

        edge_costs, node_scores_map = self._compute_edge_costs()
        if obstructions:
            self.apply_obstructions(obstructions, edge_costs)
        if self._use_constraint_costs:
            self.apply_congestion(edge_costs)

        if not self._landmarks_valid:
            self._precompute_landmarks()

        route_nodes, _ = self._alt_search(source_node, target_node, edge_costs)

        # ETA uses base travel_time_s, not the GNN-modulated cost
        eta_seconds = float(sum(
            self.graph.G[route_nodes[i]][route_nodes[i + 1]].get("travel_time_s", 60.0)
            for i in range(len(route_nodes) - 1)
        ))

        avg_score = float(np.mean([node_scores_map.get(n, 0.5) for n in route_nodes]))
        confidence = float(np.clip(avg_score * 100, 0, 100))

        coords = [
            (self.graph.G.nodes[n]["lon"], self.graph.G.nodes[n]["lat"])
            for n in route_nodes
        ]
        wkt = "LINESTRING(" + ", ".join(f"{lon} {lat}" for lon, lat in coords) + ")"

        elapsed = (time.perf_counter() - t0) * 1000
        logger.info(
            "Route %d→%d: %d nodes, ETA %.0fs, confidence %.1f%%, computed in %.1fms",
            source_node, target_node, len(route_nodes), eta_seconds, confidence, elapsed,
        )

        return {
            "route_nodes":    route_nodes,
            "eta_seconds":    round(eta_seconds),
            "gnn_confidence": round(confidence, 1),
            "route_wkt":      wkt,
            "computation_ms": round(elapsed, 1),
        }

    def compute_routes_multi_alpha(
        self,
        source_node: int,
        target_node: int,
        obstructions: Optional[List[Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Generate up to 3 routes using ALT + the penalty method.

        Route 1 (recommended): optimal path on GNN-modulated costs.
        Route 2–3 (alternative): edges from prior routes are multiplied by
            PENALTY_FACTOR to force genuinely different paths.

        ETA on every route is the sum of base travel_time_s values so times
        are always comparable across routes.
        """
        from .graph_builder import _haversine_km

        t0 = time.perf_counter()
        self._update_congestion_from_sumo()

        if self.graph.G.number_of_nodes() == 0:
            raise ValueError("Road network graph has no nodes.")

        edge_costs, node_scores_map = self._compute_edge_costs()
        if obstructions:
            self.apply_obstructions(obstructions, edge_costs)
        if self._use_constraint_costs:
            self.apply_congestion(edge_costs)

        if not self._landmarks_valid:
            self._precompute_landmarks()

        route_labels = [
            (1, "recommended", True),
            (2, "alternative", False),
            (3, "alternative", False),
        ]

        results: List[Dict[str, Any]] = []
        seen_wkts: set = set()
        # working_costs is a mutable copy — penalties accumulate across iterations
        working_costs: Dict[Tuple[int, int], float] = dict(edge_costs)

        for rank, route_type, is_selected in route_labels:
            try:
                route_nodes, _ = self._alt_search(source_node, target_node, working_costs)
            except ValueError as exc:
                logger.warning("ALT route %d failed: %s", rank, exc)
                continue

            coords = [
                (self.graph.G.nodes[n]["lon"], self.graph.G.nodes[n]["lat"])
                for n in route_nodes
            ]
            wkt = "LINESTRING(" + ", ".join(f"{lon} {lat}" for lon, lat in coords) + ")"

            # Always penalize so the next search is pushed onto a different path
            for i in range(len(route_nodes) - 1):
                u, v = route_nodes[i], route_nodes[i + 1]
                working_costs[(u, v)] = working_costs.get(
                    (u, v), self.graph.G[u][v].get("travel_time_s", 60.0)
                ) * PENALTY_FACTOR

            if wkt in seen_wkts:
                logger.debug("Route %d is duplicate — skipped", rank)
                continue
            seen_wkts.add(wkt)

            eta_seconds = float(sum(
                self.graph.G[route_nodes[i]][route_nodes[i + 1]].get("travel_time_s", 60.0)
                for i in range(len(route_nodes) - 1)
            ))
            distance_m = float(sum(
                _haversine_km(
                    coords[i][1], coords[i][0],
                    coords[i + 1][1], coords[i + 1][0],
                ) * 1000
                for i in range(len(coords) - 1)
            ))
            avg_score = float(np.mean([node_scores_map.get(n, 0.5) for n in route_nodes]))
            confidence = float(np.clip(avg_score * 100, 0, 100))

            results.append({
                "route_nodes":           route_nodes,
                "eta_seconds":           round(eta_seconds),
                "gnn_confidence":        round(confidence, 1),
                "route_wkt":             wkt,
                "route_distance_meters": round(distance_m, 1),
                "rank":                  rank,
                "route_type":            route_type,
                "is_selected":           is_selected,
            })

        elapsed = (time.perf_counter() - t0) * 1000
        logger.info(
            "Multi-route %d→%d: %d unique routes in %.1fms",
            source_node, target_node, len(results), elapsed,
        )
        return results

    def nearest_station_node(self, incident_lat: float, incident_lon: float) -> Optional[int]:
        """Return the graph node ID of the nearest fire station to an incident."""
        candidates = self.graph.nodes_near(incident_lat, incident_lon, radius_km=20.0)
        for node_id, _ in candidates:
            if self.graph.G.nodes[node_id].get("is_station"):
                return node_id
        return None

    def compute_connector(
        self,
        driver_lat: float,
        driver_lon: float,
        dest_lat: float,
        dest_lon: float,
        obstructions: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Compute a connector path from the driver's current position directly
        to the destination (incident location).

        The connector replaces the "rejoin the planned route" behaviour: the
        main route still represents the truck's originally dispatched path,
        but if the personnel deviates, the connector shows their actual best
        path to the incident from where they currently are.

        Returns a GeoJSON LineString dict:
          {"type": "LineString", "coordinates": [[lon, lat], ...]}

        Raises ValueError if driver or destination node cannot be resolved.
        """

        # 1. Snap the driver to the nearest road *segment* (perpendicular
        #    projection), not the nearest intersection vertex. Nearest-node
        #    snapping can latch onto an intersection that belongs to a parallel
        #    road; projecting onto edges keeps the connector on the road the
        #    driver is actually travelling.
        snap = self.graph.nearest_edge(driver_lat, driver_lon, radius_km=0.5)
        if snap is None:
            raise ValueError("No graph edge within 500 m of driver position")
        edge_u, edge_v, proj_lat, proj_lon, _perp_km = snap

        # 2. Nearest graph node to destination (incident)
        target_candidates = self.graph.nodes_near(dest_lat, dest_lon, radius_km=0.5)
        if not target_candidates:
            raise ValueError("No graph node within 500 m of destination")
        target_node = target_candidates[0][0]

        edge_costs, _ = self._compute_edge_costs()
        if obstructions:
            self.apply_obstructions(obstructions, edge_costs)
        if self._use_constraint_costs:
            self.apply_congestion(edge_costs)

        if not self._landmarks_valid:
            self._precompute_landmarks()

        # 3. Route from whichever endpoint of the snapped segment yields the
        #    cheaper path to the target, so the connector doesn't backtrack
        #    along the segment the driver is standing on.
        best_route: Optional[List[int]] = None
        best_cost = float("inf")
        for entry in (edge_u, edge_v):
            try:
                route_nodes, cost = self._alt_search(entry, target_node, edge_costs)
            except ValueError:
                continue
            if cost < best_cost:
                best_cost = cost
                best_route = route_nodes

        if best_route is None:
            raise ValueError("No connector route found to destination")

        # 4. Build the line: actual driver position → foot of perpendicular on
        #    the road → routed node path. Drop a routed node if it duplicates
        #    the projection point (happens when the driver projects onto an
        #    endpoint, t == 0 or t == 1).
        coords = [[driver_lon, driver_lat], [proj_lon, proj_lat]]
        for n in best_route:
            nd = self.graph.G.nodes[n]
            pt = [nd["lon"], nd["lat"]]
            if pt != coords[-1]:
                coords.append(pt)
        return {"type": "LineString", "coordinates": coords}

    def shutdown(self):
        if self.sumo:
            self.sumo.close()
