/* globals _, alert, console, document, fetch, vis */
"use strict";

var state = {
    usersById: null,
    usersByName: null,
    graphContainer: null,
    graph: null
};

fetch("data/bmmap.json")
.then(function(response) {
    return response.json();
}).then(function(json) {
    doParse(json);
    state.graphContainer = document.getElementById('graph');

});

function addContact(users, a, b) {
    var user = users[a];
    if(!user.contacts) {
        user.contacts = [];
    }

    var friend = users[b];
    user.contacts.push(friend);
}

function buildGraph(users, edges) {
    edges.forEach(e => {
        addContact(users, e.A, e.B);
        addContact(users, e.B, e.A);
    });
}

function subselect(output, node, visited, depth) {
    if(depth < 1) {
        return;
    }

    if(node.isProcessed) {
        console.log(`User ${node.userName} already processed`);
        return;
    }
    node.isProcessed = true;

    node.contacts.forEach(c => {
        output.edges.push({from: node.userId, to: c.userId });
        if(!visited[c.userId]) {
            output.nodes.push(c);

            subselect(output, c, visited, depth - 1);
            visited[c.userId] = true;
        }
    });
}

function doParse(json) {
    console.log("Making user lookup maps...");
    state.usersById = _.keyBy(json.users, 'userId');
    state.usersByName = _.keyBy(json.users, 'userName');

    console.log("Building graph...");
    buildGraph(state.usersById, json.edges);

    document.getElementById('renderButton').disabled = false;
}

function clickRender() {
    var userName = document.getElementById('userName');
    var depth = document.getElementById('depth');

    depth = parseInt(depth.options[depth.selectedIndex].value, 10);

    renderUser(userName.value, depth);
}

function renderUser(userName, depth) {
    console.log("Building subtree...");
    var root = state.usersByName[userName];
    if(!root) {
        alert("User not found!");
        return;
    }
    if(root.isProcessed) {
        console.log(`User ${userName} already processed`);
    }

    var subtree = {nodes:[root], edges:[]};
    var visited = [];
    visited[root.userId] = true;

    subselect(subtree, root, visited, depth);
    
    try {
        initializeGraph(subtree);
    }
    catch(ex) {
        console.error(ex);
        return;
    }
}

function initializeGraph(subtree) {
    if(state.graph != null) {
        return;
    }

    console.log("Constructing VisJS stuff...");
    var nodes = new vis.DataSet(_.map(subtree.nodes, o => {
            return {
                id: o.userId,
                label: o.userName
            };
        }));

    var edges = new vis.DataSet(subtree.edges);

    var visData = { nodes: nodes, edges: edges };
    var options = {
        physics: {
            enabled: true,
            // barnesHut: {
            //     avoidOverlap: 0.5
            // }
        },
        layout: {
            // hierarchical: true,
            improvedLayout: false
        }
    };

    state.graph = new vis.Network(state.graphContainer, visData, options);
    state.graph.on("selectNode", function(node) {
        console.log("Selected: ", state.usersById[node.nodes[0]].userName);
    });
    console.log("Done!");
}
