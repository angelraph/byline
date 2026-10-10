import { z } from "zod";
import { handle, addressSchema, signatureSchema } from "@/lib/api/route";
import { buildCreate, quoteCreate, registerCreate, requestImageUpload } from "@/lib/panta/api";

const url = z
  .string()
  .url("Must be a full https:// link")
  .max(2048)
  .refine((v) => /^https?:\/\//.test(v), "Must be an http(s) link");

const quoteSchema = z
  .object({
    step: z.literal("quote"),
    wallet: addressSchema,
    question: z.string().trim().min(10, "Write a full question").max(512),
    title: z.string().trim().max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    resolutionRule: z.string().trim().min(20, "Spell out exactly how it resolves").max(2048),
    sourcesOfTruth: z.array(url).min(1).max(20),
    category: z.string().min(1),
    startTime: z.number().int().positive(),
    endTime: z.number().int().positive(),
    resolutionTime: z.number().int().positive(),
    imageUrl: url,
    marketType: z.enum(["standard", "breaking"]),
    eventInProgress: z.boolean().optional(),
  })
  .refine((v) => v.startTime < v.endTime && v.endTime <= v.resolutionTime, {
    message: "Times must run start → close → resolve",
    path: ["endTime"],
  })
  .refine((v) => !v.eventInProgress || v.marketType === "breaking", {
    message: "Only breaking markets can start immediately",
    path: ["marketType"],
  });

const schema = z.union([
  quoteSchema,
  z.object({ step: z.literal("build"), createId: z.string().min(1), wallet: addressSchema }),
  z.object({ step: z.literal("register"), createId: z.string().min(1), signature: signatureSchema }),
  z.object({ step: z.literal("image") }),
]);

/** One route for the whole create session so the client drives quote → build → register. */
export const POST = handle(schema, async (input) => {
  switch (input.step) {
    case "quote": {
      const { step: _step, ...body } = input;
      void _step;
      return quoteCreate({ ...body, region: "Global" });
    }
    case "build":
      return buildCreate({ createId: input.createId, wallet: input.wallet });
    case "register":
      return registerCreate({ createId: input.createId, signature: input.signature });
    case "image":
      return requestImageUpload();
  }
});
