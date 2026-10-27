import mongoose from "mongoose";

const cardSchema = new mongoose.Schema(
  {
    board: { type: mongoose.Schema.Types.ObjectId, ref: "Board", required: true, index: true },
    list: { type: mongoose.Schema.Types.ObjectId, ref: "List", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 2000 },
    position: { type: Number, required: true },
    labels: [
      {
        _id: false,
        text: { type: String, trim: true, maxlength: 30 },
        color: { type: String, enum: ["blue", "purple", "pink", "orange", "green"], default: "blue" },
      },
    ],
    dueDate: { type: Date, default: null },
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export default mongoose.model("Card", cardSchema);
