package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
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
	edges := make(map[Edge]bool)

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
			for _, user := range contacts {
				edgeA := Edge{A: userID, B: user.ID}
				edgeB := Edge{A: user.ID, B: userID}

				if edges[edgeA] || edges[edgeB] {
					edgeHit++
				} else {
					edges[edgeA] = true
					edgeMiss++
					if userID == user.ID {
						fmt.Fprintf(os.Stderr, "\nUser '%s' (#%d) maps to itself\n", users[userID].Name, userID)
					}
				}
			}
		}
	}

	fmt.Fprintln(os.Stderr)
	fmt.Fprintf(os.Stderr, "done! - %d users\n", len(users))
	fmt.Fprintf(os.Stderr, "user hit: %d, miss: %d\n", userHit, userMiss)
	fmt.Fprintf(os.Stderr, "edge hit: %d, miss: %d\n", edgeHit, edgeMiss)
	fmt.Fprintf(os.Stderr, "Distribution of contacts per user: %v\n", numContacts)

	// Dump in Graphviz format
	for edge := range edges {
		fmt.Printf("\"%s\" -- \"%s\"\n", users[edge.A].Name, users[edge.B].Name)
	}
}
