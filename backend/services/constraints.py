"""GAT constraint styling helpers used by the map and constraint endpoints."""
import json

import state
from ai import Config


# Properties carried through to the frontend per predicted-constraint feature.
_CONSTRAINT_PROP_KEYS = (
    "road_id", "barangay", "name", "highway",
    "display_constraint_type", "routing_constraint_type",
    "map_color", "map_weight", "map_opacity",
    "model_predicted_constrained", "model_probability_pct",
    "final_display_confidence_pct", "hover_confidence_text",
    "is_manual_verified", "is_gat_only_prediction",
)


# Labels for display_constraint_type values not covered by the style config
# (the GAT-only prediction buckets the export adds for the map legend).
_DISPLAY_LABELS = {
    "predicted_constraint_high_confidence": "Predicted constraint (high confidence)",
    "predicted_constraint_review": "Predicted constraint (needs review)",
    "normal": "Normal road",
}


# Map a user-drawn custom constraint_type onto the GAT style vocabulary.
_CUSTOM_STYLE_KEY = {
    "narrow_road": "narrow_road",
    "traffic_area": "traffic_general",
}


def _load_constraint_style() -> dict:
    if state.constraint_style_cache is None:
        path = Config.CONSTRAINT_STYLE_PATH
        if path and path.exists():
            with open(path, encoding="utf-8") as f:
                state.constraint_style_cache = json.load(f)
        else:
            state.constraint_style_cache = {}
    return state.constraint_style_cache


def _label_for(dtype: str, style: dict) -> str:
    """Human label for a display_constraint_type, preferring the style config."""
    if dtype in _DISPLAY_LABELS:
        return _DISPLAY_LABELS[dtype]
    s = style.get(dtype)
    if isinstance(s, dict) and s.get("label"):
        return s["label"]
    return (dtype or "").replace("_", " ").strip().capitalize() or "Unknown"
