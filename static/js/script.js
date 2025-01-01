document.addEventListener("DOMContentLoaded", function() {
    // Create the graph
    var graph = new LGraph();
    
    // Create canvas
    var canvas = new LGraphCanvas("#graph-container", graph);
    
    // Create nodes
    var node_const = LiteGraph.createNode("basic/const");
    node_const.pos = [200, 200];
    node_const.setValue(4.5);
    graph.add(node_const);
    
    var node_watch = LiteGraph.createNode("basic/watch");
    node_watch.pos = [500, 200];
    graph.add(node_watch);
    
    // Connect nodes
    node_const.connect(0, node_watch, 0);
    
    // Start the graph
    graph.start();
});
