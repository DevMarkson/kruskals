const GREEN = "#10B981";
const RED = "#EF4444";
const EDGE_COLOUR = "#10B981"; 
const EDGE_REJECTED_COLOUR = "#EF4444"; 
const NODE_COLOUR = "#3B82F6";
const ORIGINAL_EDGE_COLOUR = "#94a3b8";

// DISJOINT SET (UNION-FIND) IMPLEMENTATION
class DisjointSet {
    constructor(nodes) {
        this.parent = {};
        this.rank = {};
        nodes.forEach(node => {
            this.parent[node.id] = node.id;
            this.rank[node.id] = 0;
        });
    }

    find(i) {
        if (this.parent[i] === i) return i;
        this.parent[i] = this.find(this.parent[i]); // Path compression
        return this.parent[i];
    }

    union(i, j) {
        let rootI = this.find(i);
        let rootJ = this.find(j);

        if (rootI !== rootJ) {
            if (this.rank[rootI] < this.rank[rootJ]) {
                this.parent[rootI] = rootJ;
            } else if (this.rank[rootI] > this.rank[rootJ]) {
                this.parent[rootJ] = rootI;
            } else {
                this.parent[rootJ] = rootI;
                this.rank[rootI]++;
            }
            return true; // Union successful (no cycle)
        }
        return false; // Cycle detected
    }
}

// Global state for dynamic updates
let currentRunId = 0;
let nodesArray = [];
let allEdges = [];

let nodesOriginal = new vis.DataSet([]);
let edgesOriginal = new vis.DataSet([]);
let networkOriginal = null;

let nodesKruskal = new vis.DataSet([]);
let edgesKruskal = new vis.DataSet([]);
let networkKruskal = null;

let containerOriginal = document.getElementById('network-original');
let containerKruskal = document.getElementById('network-kruskal');
let statusBox = document.getElementById('status-box');

function parseGraphInput() {
    const text = document.getElementById('graph-input').value;
    const lines = text.split('\n');
    const nodeSet = new Set();
    const parsedEdges = [];

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;
        // Match "Node1-Node2:Weight" format
        const match = line.match(/^([^-:]+)-([^-:]+):(-?\d+)$/);
        if (match) {
            const u = match[1].trim();
            const v = match[2].trim();
            const w = parseInt(match[3], 10);
            nodeSet.add(u);
            nodeSet.add(v);
            parsedEdges.push({ from: u, to: v, label: String(w), weight: w });
        }
    });

    nodesArray = Array.from(nodeSet).map(id => ({ id, label: id, color: NODE_COLOUR }));
    allEdges = parsedEdges;
    // Note: We don't sort allEdges immediately here, we will copy and sort for the algorithm run
}

function initNetwork() {
    // 1. Initialize Original Graph View
    nodesOriginal = new vis.DataSet(JSON.parse(JSON.stringify(nodesArray)));
    edgesOriginal = new vis.DataSet(allEdges.map((e, index) => ({
        id: `orig_edge_${index}`,
        from: e.from,
        to: e.to,
        label: e.label,
        color: { color: ORIGINAL_EDGE_COLOUR, highlight: ORIGINAL_EDGE_COLOUR },
        width: 2
    })));

    const dataOriginal = { nodes: nodesOriginal, edges: edgesOriginal };
    const optionsOriginal = {
        physics: {
            enabled: true,
            barnesHut: { springLength: 150 }
        },
        edges: {
            font: { size: 16, align: 'top' },
            smooth: false
        },
        interaction: {
            zoomView: false
        }
    };

    if (networkOriginal) networkOriginal.destroy();
    networkOriginal = new vis.Network(containerOriginal, dataOriginal, optionsOriginal);

    // 2. Initialize Kruskal Process View (Starts with no edges)
    nodesKruskal = new vis.DataSet(JSON.parse(JSON.stringify(nodesArray)));
    edgesKruskal = new vis.DataSet([]);

    const dataKruskal = { nodes: nodesKruskal, edges: edgesKruskal };
    const optionsKruskal = {
        physics: {
            enabled: true, // Will be disabled once positions sync
            barnesHut: { springLength: 150 }
        },
        edges: {
            font: { size: 16, align: 'top' },
            smooth: false
        },
        interaction: {
            zoomView: false
        }
    };

    if (networkKruskal) networkKruskal.destroy();
    networkKruskal = new vis.Network(containerKruskal, dataKruskal, optionsKruskal);

    // 3. Synchronize layouts: copy node positions from Original network to Kruskal network
    // to make sure they look exactly matching side by side.
    networkOriginal.on("stabilized", function () {
        const positions = networkOriginal.getPositions();
        for (const nodeId in positions) {
            nodesKruskal.update({ id: nodeId, x: positions[nodeId].x, y: positions[nodeId].y });
        }
        // Lock positions in both networks so they match exactly and stop drifting
        networkOriginal.setOptions({ physics: { enabled: false } });
        networkKruskal.setOptions({ physics: { enabled: false } });
        
        // Centering and fitting all nodes in the visible area
        setTimeout(() => {
            networkOriginal.fit({ animation: { duration: 300, easingFunction: 'easeInOutQuad' } });
            networkKruskal.fit({ animation: { duration: 300, easingFunction: 'easeInOutQuad' } });
        }, 50);
    });
}

// Helper function to pause execution for animations
const delay = ms => new Promise(res => setTimeout(res, ms));

// ANIMATION & ALGORITHM LOGIC
async function runKruskal(runId) {
    // Sort edges for Kruskal's algorithm
    const sortedEdges = [...allEdges].sort((a, b) => a.weight - b.weight);
    const ds = new DisjointSet(nodesArray);
    let acceptedEdgesCount = 0;
    const targetEdges = nodesArray.length > 0 ? nodesArray.length - 1 : 0;

    statusBox.style.color = "black";
    statusBox.innerText = "Sorting edges... starting algorithm.";
    await delay(1500);
    if (currentRunId !== runId) return;

    for (let i = 0; i < sortedEdges.length; i++) {
        // Stop early if MST is complete
        if (acceptedEdgesCount === targetEdges) {
            break;
        }

        const edge = sortedEdges[i];
        statusBox.style.color = "black";
        statusBox.innerText = `Evaluating edge ${edge.from}-${edge.to} (Weight: ${edge.weight})...`;

        await delay(1200);
        if (currentRunId !== runId) return;

        if (ds.union(edge.from, edge.to)) {
            // ACCEPTED
            statusBox.style.color = GREEN;
            statusBox.innerText = `Accepted edge ${edge.from}-${edge.to}!`;
            
            // Add to Kruskal network
            edgesKruskal.add({
                id: `kruskal_edge_${i}`,
                from: edge.from,
                to: edge.to,
                label: edge.label,
                color: { color: EDGE_COLOUR, highlight: EDGE_COLOUR },
                width: 4
            });
            acceptedEdgesCount++;
        } else {
            // REJECTED (CYCLE)
            statusBox.style.color = RED;
            statusBox.innerText = `Rejected edge ${edge.from}-${edge.to} (Forms a Cycle).`;

            // Draw it dashed red to show it fails in Kruskal view
            edgesKruskal.add({
                id: `kruskal_edge_${i}`,
                from: edge.from,
                to: edge.to,
                label: edge.label,
                color: { color: EDGE_REJECTED_COLOUR, highlight: EDGE_REJECTED_COLOUR },
                dashes: true,
                width: 2
            });

            await delay(1200); // Leave the red line up briefly
            if (currentRunId !== runId) return;
            edgesKruskal.remove(`kruskal_edge_${i}`); // Remove from Kruskal view
        }

        await delay(1200); // Pause before moving to the next edge
        if (currentRunId !== runId) return;
    }

    // Final state
    if (acceptedEdgesCount === targetEdges && targetEdges > 0) {
        statusBox.style.color = GREEN;
        statusBox.innerText = "🎉 Minimum Spanning Tree Complete! 🎉";
        if (networkKruskal) networkKruskal.setOptions({ physics: { enabled: false } });
    } else if (targetEdges > 0) {
        statusBox.style.color = RED;
        statusBox.innerText = "Algorithm finished. (Graph was disconnected)";
    } else {
        statusBox.style.color = "black";
        statusBox.innerText = "No graph data.";
    }
}

function updateGraph() {
    parseGraphInput();
    resetGraph();
}

function resetGraph() {
    currentRunId++;
    initNetwork();
    runKruskal(currentRunId);
}

// Start the process initially
updateGraph();
