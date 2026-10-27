import mongoose from "mongoose";

const listSchema = new mongoose.Schema(
  {
    board: { type: mongoose.Schema.Types.ObjectId, ref: "Board", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    position: { type: Number, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("List", listSchema);
