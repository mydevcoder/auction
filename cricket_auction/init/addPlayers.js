// samplePlayers.js
const mongoose = require("mongoose");
const Player = require("./models/Player");

// Assume these are your team IDs from your Team collection
const RCB = new mongoose.Types.ObjectId("64a1fbc1234567890abcdef1"); // RCB
const MI  = new mongoose.Types.ObjectId("64a1fbc1234567890abcdef2"); // MI

const samplePlayers = [
  {
    name: "Virat Kohli",
    role: "Batsman",
    basePrice: 2000000,
    image: "https://example.com/virat.jpg",
    sold: true,
    soldPrice: 3000000,
    soldTo: RCB
  },
  {
    name: "Rohit Sharma",
    role: "Batsman",
    basePrice: 1800000,
    image: "https://example.com/rohit.jpg",
    sold: true,
    soldPrice: 2500000,
    soldTo: MI
  },
  {
    name: "Jasprit Bumrah",
    role: "Bowler",
    basePrice: 1500000,
    image: "https://example.com/bumrah.jpg",
    sold: true,
    soldPrice: 2200000,
    soldTo: MI
  },
  {
    name: "Glenn Maxwell",
    role: "All-Rounder",
    basePrice: 1700000,
    image: "https://example.com/maxwell.jpg",
    sold: true,
    soldPrice: 2100000,
    soldTo: RCB
  },
  {
    name: "AB de Villiers",
    role: "Batsman",
    basePrice: 1600000,
    image: "https://example.com/ab.jpg",
    sold: true,
    soldPrice: 2000000,
    soldTo: RCB
  },
  {
    name: "Ishan Kishan",
    role: "Wicket-Keeper",
    basePrice: 1200000,
    image: "https://example.com/ishan.jpg",
    sold: true,
    soldPrice: 1600000,
    soldTo: MI
  },
  {
    name: "Mohammed Siraj",
    role: "Bowler",
    basePrice: 800000,
    image: "https://example.com/siraj.jpg",
    sold: true,
    soldPrice: 1000000,
    soldTo: RCB
  },
  {
    name: "Hardik Pandya",
    role: "All-Rounder",
    basePrice: 1500000,
    image: "https://example.com/hardik.jpg",
    sold: true,
    soldPrice: 1900000,
    soldTo: MI
  },
  {
    name: "Yuzvendra Chahal",
    role: "Bowler",
    basePrice: 1000000,
    image: "https://example.com/chahal.jpg",
    sold: false,
    soldPrice: 0,
    soldTo: null
  },
  {
    name: "Dinesh Karthik",
    role: "Wicket-Keeper",
    basePrice: 900000,
    image: "https://example.com/dk.jpg",
    sold: false,
    soldPrice: 0,
    soldTo: null
  }
];

module.exports = samplePlayers;
