import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import (
    GCNConv,
    GATConv,
    SAGEConv,
)

# ================================================================
# GCN — Graph Convolutional Network
# ================================================================
# How it works:
#   Each road intersection collects features from all its
#   neighboring intersections and averages them with equal weight.
#   After several layers, each intersection captures information
#   from a wider area of the road network.
#
# Why included:
#   GCN is the baseline model. Simple, fast to train, and
#   well validated on road graphs. Bai et al. (2021) showed
#   that A3T-GCN achieves strong traffic prediction accuracy.
# ================================================================

class GCN(nn.Module):

    def __init__(self, in_channels, hidden_channels, out_channels,
                 num_layers=3, dropout=0.3):
        super().__init__()
        self.dropout = dropout
        self.convs   = nn.ModuleList()

        # First layer: input features to hidden size
        self.convs.append(GCNConv(in_channels, hidden_channels))

        # Middle layers: hidden to hidden
        for _ in range(num_layers - 2):
            self.convs.append(GCNConv(hidden_channels, hidden_channels))

        # Last layer: hidden to output
        self.convs.append(GCNConv(hidden_channels, out_channels))

    def forward(self, x, edge_index):
        for i, conv in enumerate(self.convs):
            x = conv(x, edge_index)
            if i < len(self.convs) - 1:
                x = F.relu(x)
                x = F.dropout(x, p=self.dropout, training=self.training)
        return x


# ================================================================
# GAT — Graph Attention Network
# ================================================================
# How it works:
#   Instead of averaging neighbors equally like GCN, GAT learns
#   a separate attention weight for each neighbor. More important
#   roads get higher attention. Multiple attention heads learn
#   different patterns at the same time and combine their results.
#
# Why included:
#   Zhao et al. (2022) showed causal GAT outperformed GCN,
#   DCRNN, and ASTGCN in traffic prediction. Wang et al. (2022)
#   validated multi-head GAT on directed transportation networks
#   with RMSE reductions of 2.3 to 22.5 percent over baselines.
#   Ideal for Panabo roads where some segments are critical
#   bottlenecks and others are minor side streets.
# ================================================================

class GAT(nn.Module):

    def __init__(self, in_channels, hidden_channels, out_channels,
                 num_layers=3, heads=4, dropout=0.3):
        super().__init__()
        self.dropout = dropout
        self.convs   = nn.ModuleList()

        # First layer: input to hidden with multi-head attention
        # concat=True means all head outputs are joined together
        # so actual output size becomes hidden_channels * heads
        self.convs.append(
            GATConv(in_channels, hidden_channels,
                    heads=heads, dropout=dropout, concat=True)
        )

        # Middle layers
        for _ in range(num_layers - 2):
            self.convs.append(
                GATConv(hidden_channels * heads, hidden_channels,
                        heads=heads, dropout=dropout, concat=True)
            )

        # Last layer: single head, no concatenation
        self.convs.append(
            GATConv(hidden_channels * heads, out_channels,
                    heads=1, dropout=dropout, concat=False)
        )

    def forward(self, x, edge_index):
        for i, conv in enumerate(self.convs):
            x = conv(x, edge_index)
            if i < len(self.convs) - 1:
                x = F.elu(x)   # ELU works better than ReLU for GAT
                x = F.dropout(x, p=self.dropout, training=self.training)
        return x


# ================================================================
# GraphSAGE — Graph Sample and Aggregate
# ================================================================
# How it works:
#   Instead of using all neighbors like GCN and GAT, GraphSAGE
#   samples a fixed number of neighbors per layer and aggregates
#   them. Most importantly it is INDUCTIVE — it can score road
#   nodes it never saw during training. Useful when new roads
#   are added to Panabo City without retraining from scratch.
#
# Why included:
#   Wang et al. (2025) applied GraphSAGE to urban road topology
#   for traffic-flow prediction. Liu and Meidani (2025) validated
#   GraphSAGE specifically for emergency response routing — the
#   most direct analogue to the BFP routing system.
# ================================================================

class GraphSAGE(nn.Module):

    def __init__(self, in_channels, hidden_channels, out_channels,
                 num_layers=3, dropout=0.3):
        super().__init__()
        self.dropout = dropout
        self.convs   = nn.ModuleList()

        # First layer
        self.convs.append(SAGEConv(in_channels, hidden_channels))

        # Middle layers
        for _ in range(num_layers - 2):
            self.convs.append(SAGEConv(hidden_channels, hidden_channels))

        # Last layer
        self.convs.append(SAGEConv(hidden_channels, out_channels))

    def forward(self, x, edge_index):
        for i, conv in enumerate(self.convs):
            x = conv(x, edge_index)
            if i < len(self.convs) - 1:
                x = F.relu(x)
                x = F.dropout(x, p=self.dropout, training=self.training)
        return x
