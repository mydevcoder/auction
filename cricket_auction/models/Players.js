const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema({
  name: String,
  className: String,
  basePrice: Number,
  sold: { type: Boolean, default: false },
  team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
  soldPrice: { type: Number, default: 0 },
});

module.exports = mongoose.model("Player", playerSchema);
