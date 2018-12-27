/* globals _, alert, console, document, fetch, vis */
"use strict";

var state = {
	users: null,
	usersById: null,
	usersByName: null,
	userSet: new Set(),
	graphContainer: null,
	graph: null,
	graphData: null
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
	state.users = json.users;
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

function clickReset() {
	state.users.forEach(u => u.isProcessed = false);
	state.userSet.clear();
	state.graphData.nodes.clear();
	state.graphData.edges.clear();
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
		if(initializeGraph(subtree)) {
			// graph already initialized, add dataset to existing graph. TODO: avoid duplicate edges.
			var filtered = _.filter(subtree.nodes, n => !state.userSet.has(n.userId));

			state.graphData.nodes.add(_.map(filtered, massageNode));
			state.graphData.edges.add(subtree.edges);

			subtree.nodes.map(n => n.userId).forEach(id => state.userSet.add(id));
		}
	}
	catch(ex) {
		console.error(ex);
		return;
	}

	console.log("Done!");
}

function massageNode(node) {
	return {
		id: node.userId,
		label: node.userName
	};
}

function initializeGraph(subtree) {
	if(state.graph != null) {
		return true;
	}

	console.log("Current userset: ", state.userSet);
	subtree.nodes.map(n => n.userId).forEach(id => state.userSet.add(id));
	console.log("Updated userset: ", state.userSet);

	console.log("Constructing VisJS stuff...");
	var nodes = new vis.DataSet(_.map(subtree.nodes, massageNode));

	var edges = new vis.DataSet(subtree.edges);

	state.graphData = { nodes: nodes, edges: edges };
	var options = {
		physics: {
			enabled: true,
		},
		layout: {
			improvedLayout: false
		}
	};

	state.graph = new vis.Network(state.graphContainer, state.graphData, options);
	state.graph.on("selectNode", function(node) {
		console.log("Selected: ", state.usersById[node.nodes[0]].userName);
	});
	state.graph.on("doubleClick", function(node) {
		if(node.nodes.length > 0) {
			renderUser(state.usersById[node.nodes[0]].userName,1 );
		}
	});
	console.log("Done!");

	return false;
}
