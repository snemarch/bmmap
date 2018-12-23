"use strict";

fetch("bmmap.json")
.then(function(responce) {
    return responce.json();
}).then(function(json) {
    do_parse(json);
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
        addContact(users, e.A, e.B)
        addContact(users, e.B, e.A)
    });
}

function subselect(output, node, visited, depth) {
    if(depth < 1) {
        return
    }

    node.contacts.forEach(c => {
        output.edges.push({from: node.userId, to: c.userId });
        if(!visited[c.userId]) {
            output.nodes.push(c);

            subselect(output, c, visited, depth - 1);
            visited[c.userId] = true;
        }
    });
}

var usersById, usersByName;

function do_parse(json) {
    console.log("Making user lookup maps...")
    usersById = _.keyBy(json.users, 'userId');
    usersByName = _.keyBy(json.users, 'userName');

    console.log("Building graph...");
    buildGraph(usersById, json.edges);

    document.getElementById('renderButton').disabled = false;
}

function do_render() {
    var userName = document.getElementById('userName');
    var depth = document.getElementById('depth');

    depth = parseInt(depth.options[depth.selectedIndex].value, 10);

    render_user(userName.value, depth);
}

function render_user(userName, depth) {
    console.log("Building subtree...")
    var root = usersByName[userName];
    if(!root) {
        alert("User not found!");
        return;
    }

    var subtree = {nodes:[root], edges:[]};
    var visited = [];
    visited[root.userId] = true;

    subselect(subtree, root, visited, depth);

    console.log("Subtree: ", subtree);

    console.log("Constructing VisJS stuff...");

    try {
        var nodes = new vis.DataSet(_.map(subtree.nodes, o => {
            return {
                id: o.userId,
                label: o.userName
            }
        }));

        var edges = new vis.DataSet(subtree.edges);
    }
    catch(ex) {
        console.error(ex);
        return;
    }

    var container = document.getElementById('graph')
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

    var network = new vis.Network(container, visData, options);
    console.log("Done!");
}
