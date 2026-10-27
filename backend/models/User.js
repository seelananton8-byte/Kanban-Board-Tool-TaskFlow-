import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false }, // absent for Google-only users
    googleId: { type: String, index: true, sparse: true },
    refreshTokens: { type: [String], select: false, default: [] }, // sha256 hashes
  },
  { timestamps: true }
);

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.refreshTokens;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model("User", userSchema);
