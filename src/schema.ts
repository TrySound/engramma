import { z } from "zod";

// Component can be a number or the 'none' keyword
const ComponentSchema = z.union([z.number(), z.literal("none")]);

// Supported color spaces according to Design Tokens spec
const SupportedColorSpaces = z.enum([
  "srgb",
  "srgb-linear",
  "hsl",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "display-p3",
  "a98-rgb",
  "prophoto-rgb",
  "rec2020",
  "xyz-d65",
  "xyz-d50",
]);

const ColorValueSchema = z.object({
  colorSpace: SupportedColorSpaces,
  components: z.array(ComponentSchema),
  alpha: z.number().min(0).max(1).optional(),
  hex: z.string().optional(),
});

export type ColorValue = z.infer<typeof ColorValueSchema>;

const ColorSchema = z.object({
  type: z.literal("color"),
  value: ColorValueSchema,
});

const RawColorSchema = z.object({
  type: z.literal("color"),
  value: z.union([ColorValueSchema, z.string()]),
});

const DimensionValueSchema = z.object({
  value: z.number(),
  unit: z.enum(["px", "rem"]),
});

export type DimensionValue = z.infer<typeof DimensionValueSchema>;

const DimensionSchema = z.object({
  type: z.literal("dimension"),
  value: DimensionValueSchema,
});

const RawDimensionSchema = z.object({
  type: z.literal("dimension"),
  value: z.union([DimensionValueSchema, z.string()]),
});

const DurationValueSchema = z.object({
  value: z.number(),
  unit: z.enum(["ms", "s"]),
});

export type DurationValue = z.infer<typeof DurationValueSchema>;

const DurationSchema = z.object({
  type: z.literal("duration"),
  value: DurationValueSchema,
});

const RawDurationSchema = z.object({
  type: z.literal("duration"),
  value: z.union([DurationValueSchema, z.string()]),
});

const NumberSchema = z.object({
  type: z.literal("number"),
  value: z.number(),
});

const RawNumberSchema = z.object({
  type: z.literal("number"),
  value: z.union([z.number(), z.string()]),
});

const CubicBezierValueSchema = z
  .tuple([z.number(), z.number(), z.number(), z.number()])
  .refine(
    ([x1, , x2]) => x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1,
    "Cubic bezier x-coordinates must be between 0 and 1",
  );

export type CubicBezierValue = z.infer<typeof CubicBezierValueSchema>;

const CubicBezierSchema = z.object({
  type: z.literal("cubicBezier"),
  value: CubicBezierValueSchema,
});

const RawCubicBezierSchema = z.object({
  type: z.literal("cubicBezier"),
  value: z.union([CubicBezierValueSchema, z.string()]),
});

const FontFamilyValueSchema = z.union([z.string(), z.array(z.string())]);

export type FontFamilyValue = z.infer<typeof FontFamilyValueSchema>;

const FontFamilySchema = z.object({
  type: z.literal("fontFamily"),
  value: FontFamilyValueSchema,
});

const RawFontFamilySchema = z.object({
  type: z.literal("fontFamily"),
  value: z.union([FontFamilyValueSchema, z.string()]),
});

const FontWeightValueSchema = z.union([z.number(), z.string()]);

const FontWeightSchema = z.object({
  type: z.literal("fontWeight"),
  value: FontWeightValueSchema,
});

const RawFontWeightSchema = z.object({
  type: z.literal("fontWeight"),
  value: z.union([FontWeightValueSchema, z.string()]),
});

const StrokeStyleValueSchema = z.union([
  z.literal("solid"),
  z.literal("dashed"),
  z.literal("dotted"),
  z.literal("double"),
  z.literal("groove"),
  z.literal("ridge"),
  z.literal("outset"),
  z.literal("inset"),
  z.object({
    dashArray: z.array(DimensionValueSchema),
    lineCap: z.union([
      z.literal("round"),
      z.literal("butt"),
      z.literal("square"),
    ]),
  }),
]);

export type StrokeStyleValue = z.infer<typeof StrokeStyleValueSchema>;

const StrokeStyleSchema = z.object({
  type: z.literal("strokeStyle"),
  value: StrokeStyleValueSchema,
});

const RawStrokeStyleSchema = z.object({
  type: z.literal("strokeStyle"),
  value: z.union([StrokeStyleValueSchema, z.string()]),
});

const TransitionValueSchema = z.object({
  duration: DurationValueSchema,
  delay: DurationValueSchema,
  timingFunction: CubicBezierValueSchema,
});

export type TransitionValue = z.infer<typeof TransitionValueSchema>;

const TransitionSchema = z.object({
  type: z.literal("transition"),
  value: TransitionValueSchema,
});

const RawTransitionSchema = z.object({
  type: z.literal("transition"),
  value: z.union([
    z.object({
      duration: z.union([DurationValueSchema, z.string()]),
      delay: z.union([DurationValueSchema, z.string()]),
      timingFunction: z.union([CubicBezierValueSchema, z.string()]),
    }),
    z.string(), // token reference
  ]),
});

export const ShadowItemSchema = z.object({
  color: ColorValueSchema,
  offsetX: DimensionValueSchema,
  offsetY: DimensionValueSchema,
  blur: DimensionValueSchema,
  spread: DimensionValueSchema.optional(),
  inset: z.boolean().optional(),
});

export type ShadowItem = z.infer<typeof ShadowItemSchema>;

const ShadowValueSchema = z.array(ShadowItemSchema);

export type ShadowValue = z.infer<typeof ShadowValueSchema>;

const ShadowSchema = z.object({
  type: z.literal("shadow"),
  value: ShadowValueSchema,
});

const RawShadowItemSchema = z.object({
  color: z.union([ColorValueSchema, z.string()]),
  offsetX: z.union([DimensionValueSchema, z.string()]),
  offsetY: z.union([DimensionValueSchema, z.string()]),
  blur: z.union([DimensionValueSchema, z.string()]),
  spread: z.union([DimensionValueSchema, z.string()]).optional(),
  inset: z.boolean().optional(),
});

const RawShadowSchema = z.object({
  type: z.literal("shadow"),
  value: z.union([
    z.array(RawShadowItemSchema),
    z.string(), // token reference
  ]),
});

const BorderValueSchema = z.object({
  color: ColorValueSchema,
  width: DimensionValueSchema,
  style: StrokeStyleValueSchema,
});

export type BorderValue = z.infer<typeof BorderValueSchema>;

const BorderSchema = z.object({
  type: z.literal("border"),
  value: BorderValueSchema,
});

const RawBorderSchema = z.object({
  type: z.literal("border"),
  value: z.union([
    z.object({
      color: z.union([ColorValueSchema, z.string()]),
      width: z.union([DimensionValueSchema, z.string()]),
      style: z.union([StrokeStyleValueSchema, z.string()]),
    }),
    z.string(), // token reference
  ]),
});

const TypographyValueSchema = z.object({
  fontFamily: FontFamilyValueSchema,
  fontSize: DimensionValueSchema,
  fontWeight: FontWeightValueSchema,
  letterSpacing: DimensionValueSchema,
  lineHeight: z.number(),
});

export type TypographyValue = z.infer<typeof TypographyValueSchema>;

const TypographySchema = z.object({
  type: z.literal("typography"),
  value: TypographyValueSchema,
});

const RawTypographySchema = z.object({
  type: z.literal("typography"),
  value: z.union([
    z.object({
      fontFamily: z.union([FontFamilyValueSchema, z.string()]),
      fontSize: z.union([DimensionValueSchema, z.string()]),
      fontWeight: z.union([FontWeightValueSchema, z.string()]),
      letterSpacing: z.union([DimensionValueSchema, z.string()]),
      lineHeight: z.union([z.number(), z.string()]),
    }),
    z.string(), // token reference
  ]),
});

const GradientPosition = z.number().min(0).max(1);

const GradientValueSchema = z.array(
  z.object({
    color: ColorValueSchema,
    position: GradientPosition,
  }),
);

export type GradientValue = z.infer<typeof GradientValueSchema>;

const GradientSchema = z.object({
  type: z.literal("gradient"),
  value: GradientValueSchema,
});

const RawGradientSchema = z.object({
  type: z.literal("gradient"),
  value: z.union([
    z.array(
      z.object({
        color: z.union([ColorValueSchema, z.string()]),
        position: GradientPosition,
      }),
    ),
    z.string(), // token reference
  ]),
});

export const ValueSchema = z.union([
  // primitive tokens
  ColorSchema,
  DimensionSchema,
  DurationSchema,
  CubicBezierSchema,
  NumberSchema,
  FontFamilySchema,
  FontWeightSchema,
  StrokeStyleSchema,
  // composite tokens
  TransitionSchema,
  ShadowSchema,
  BorderSchema,
  TypographySchema,
  GradientSchema,
]);

export type Value = z.infer<typeof ValueSchema>;

export const RawValueSchema = z.union([
  // primitive tokens
  RawColorSchema,
  RawDimensionSchema,
  RawDurationSchema,
  RawCubicBezierSchema,
  RawNumberSchema,
  RawFontFamilySchema,
  RawFontWeightSchema,
  RawStrokeStyleSchema,
  // composite tokens
  RawTransitionSchema,
  RawShadowSchema,
  RawBorderSchema,
  RawTypographySchema,
  RawGradientSchema,
]);

export type RawValue = z.infer<typeof RawValueSchema>;

/* make sure Value and Raw Value are in sync */
(({}) as unknown as Value)["type"] satisfies RawValue["type"];
(({}) as unknown as RawValue)["type"] satisfies Value["type"];
