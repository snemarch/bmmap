package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// User is a blackmarket user
type User struct {
	ID    int    `json:"userId"`
	Name  string `json:"userName"`
	Title string `json:"title"`
}

// Edge is an edge between two users
type Edge struct {
	A int
	B int
}

type jsonOutput struct {
	Users []User `json:"users"`
	Edges []Edge `json:"edges"`
}

var numContacts = make(map[int]int)

func readContacts(name string) (int, []User) {
	file, err := os.Open(name)
	if err != nil {
		log.Fatal(err)
	}

	defer file.Close()

	contents, err := ioutil.ReadAll(file)
	if err != nil {
		log.Fatal(err)
	}

	var users []User
	err = json.Unmarshal(contents, &users)
	if err != nil {
		log.Fatal(err)
	}

	numContacts[len(users)]++

	_, justName := filepath.Split(name)
	userID, _ := strconv.Atoi(strings.Split(justName, ".")[0]) // 42.contacts.json

	return userID, users
}

func edgeValues(edges map[Edge]bool) []Edge {
	result := make([]Edge, len(edges))
	i := 0
	for k := range edges {
		result[i] = k
		i++
	}
	return result
}

func userValues(users map[int]User) []User {
	result := make([]User, len(users))
	i := 0
	for _, v := range users {
		result[i] = v
		i++
	}
	return result
}

func userIDs(users map[int]bool) []int {
	result := make([]int, len(users))
	i := 0
	for v := range users {
		result[i] = v
		i++
	}
	return result
}

func dumpGraphviz(users map[int]User, edges []Edge) {
	clusterID := -1
	for _, edge := range edges {
		if clusterID != edge.A {
			if clusterID != -1 {
				fmt.Println("}")
			}
			clusterID = edge.A
			fmt.Printf("subgraph cluster_%d {\n", clusterID)
		}

		fmt.Printf("\t\"%s\" -- \"%s\"\n", users[edge.A].Name, users[edge.B].Name)
	}
	fmt.Println("}")
}

func dumpJSON(users map[int]User, edges []Edge) {
	dump := jsonOutput{Users: userValues(users), Edges: edges}
	bytes, _ := json.Marshal(dump)
	os.Stdout.Write(bytes)
}

func prune(users map[int]User, edges map[Edge]bool) (int, map[int]bool) {
	numPruned := 0
	pruned := make(map[int]bool)
	for edge := range edges {
		_, hasA := users[edge.A]
		_, hasB := users[edge.B]
		if !hasA || !hasB {
			numPruned++
			if !hasA {
				pruned[edge.A] = true
			}
			if !hasB {
				pruned[edge.B] = true
			}
			delete(edges, edge)
		}
	}
	return numPruned, pruned
}

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Syntax: bmmap [dumppath]")
		return
	}

	var names, err = filepath.Glob(filepath.Join(os.Args[1], "**/*.contacts.json"))
	if err != nil {
		log.Fatal(err)
	}
	if len(names) < 1 {
		fmt.Println("No files, aborting")
		return
	}

	users := make(map[int]User)
	edges := make(map[Edge]bool) // note: used to emulate a set

	userHit := 0
	userMiss := 0
	edgeHit := 0
	edgeMiss := 0

	// possibly:
	// 	num-cores goroutines for chomping through globlist, sending deserialized data to processing channel?
	for index, name := range names {
		if index%100 == 0 {
			fmt.Fprintf(os.Stderr, "\rProcessing profile %d", index)
		}

		userID, contacts := readContacts(name)

		for _, contact := range contacts {
			if _, ok := users[contact.ID]; ok == false {
				users[contact.ID] = contact
				userMiss++
			} else {
				userHit++
			}

			/*
			   The first idea was to extract edges from contacts by make(map[int][]int), i.e. userId -> []contactId.

			   However, a social graph like this is not directed, so we can greatly reduce the amount of edges by not
			   inserting a (b -> a) edge if we already have a (a -> b) one.
			*/
			edgeA := Edge{A: userID, B: contact.ID}
			edgeB := Edge{A: contact.ID, B: userID}

			if edges[edgeA] || edges[edgeB] {
				edgeHit++
			} else {
				edges[edgeA] = true
				edgeMiss++
				if userID == contact.ID {
					fmt.Fprintf(os.Stderr, "\nUser '%s' (#%d) maps to itself\n", users[userID].Name, userID)
				}
			}
		}
	}

	numPruned, pruned := prune(users, edges)
	prunedIDs := userIDs(pruned)

	fmt.Fprintln(os.Stderr)
	fmt.Fprintf(os.Stderr, "%d edges pruned because of %d missing users: %v\n",
		numPruned, len(prunedIDs), prunedIDs)
	fmt.Fprintf(os.Stderr, "done! - %d users\n", len(users))
	fmt.Fprintf(os.Stderr, "user hit: %d, miss: %d\n", userHit, userMiss)
	fmt.Fprintf(os.Stderr, "edge hit: %d, miss: %d\n", edgeHit, edgeMiss)
	fmt.Fprintf(os.Stderr, "Distribution of contacts per user: %v\n", numContacts)

	sortedEdges := edgeValues(edges)
	sort.Slice(sortedEdges, func(i, j int) bool {
		return sortedEdges[i].A < sortedEdges[j].A
	})

	//	dumpGraphviz(userValues(users), sortedEdges)
	dumpJSON(users, sortedEdges)
}
