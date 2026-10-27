import mongoose from "mongoose";

const boardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [
      {
        _id: false,
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        role: { type: String, enum: ["owner", "admin", "member"], default: "member" },
      },
    ],
  },
  { timestamps: true }
);

boardSchema.index({ "members.user": 1 });
export default mongoose.model("Board", boardSchema);
