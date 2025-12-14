import { z } from "zod";
import {
  colorValue,
  cubicBezierValue,
  dimensionValue,
  durationValue,
  fontFamilyValue,
  strokeStyleValue,
} from "./dtcg.schema";

export type {
  ColorValue,
  DimensionValue,
  DurationValue,
  CubicBezierValue,
  FontFamilyValue,
  StrokeStyleValue,
} from "./dtcg.schema";

const ColorSchema = z.object({
  type: z.literal("color"),
  value: colorValue,
});

const RawColorSchema = z.object({
  type: z.literal("color"),
  value: z.union([colorValue, z.string()]),
});

const DimensionSchema = z.object({
  type: z.literal("dimension"),
  value: dimensionValue,
});

const RawDimensionSchema = z.object({
  type: z.literal("dimension"),
  value: z.union([dimensionValue, z.string()]),
});

const DurationSchema = z.object({
  type: z.literal("duration"),
  value: durationValue,
});

const RawDurationSchema = z.object({
  type: z.literal("duration"),
  value: z.union([durationValue, z.string()]),
});

const NumberSchema = z.object({
  type: z.literal("number"),
  value: z.number(),
});

const RawNumberSchema = z.object({
  type: z.literal("number"),
  value: z.union([z.number(), z.string()]),
});

const CubicBezierSchema = z.object({
  type: z.literal("cubicBezier"),
  value: cubicBezierValue,
});

const RawCubicBezierSchema = z.object({
  type: z.literal("cubicBezier"),
  value: z.union([cubicBezierValue, z.string()]),
});

const FontFamilySchema = z.object({
  type: z.literal("fontFamily"),
  value: fontFamilyValue,
});

const RawFontFamilySchema = z.object({
  type: z.literal("fontFamily"),
  value: z.union([fontFamilyValue, z.string()]),
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

const StrokeStyleSchema = z.object({
  type: z.literal("strokeStyle"),
  value: strokeStyleValue,
});

const RawStrokeStyleSchema = z.object({
  type: z.literal("strokeStyle"),
  value: z.union([strokeStyleValue, z.string()]),
});

const TransitionValueSchema = z.object({
  duration: durationValue,
  delay: durationValue,
  timingFunction: cubicBezierValue,
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
      duration: z.union([durationValue, z.string()]),
      delay: z.union([durationValue, z.string()]),
      timingFunction: z.union([cubicBezierValue, z.string()]),
    }),
    z.string(), // token reference
  ]),
});

export const ShadowItemSchema = z.object({
  color: colorValue,
  offsetX: dimensionValue,
  offsetY: dimensionValue,
  blur: dimensionValue,
  spread: dimensionValue,
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
  color: z.union([colorValue, z.string()]),
  offsetX: z.union([dimensionValue, z.string()]),
  offsetY: z.union([dimensionValue, z.string()]),
  blur: z.union([dimensionValue, z.string()]),
  spread: z.union([dimensionValue, z.string()]),
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
  color: colorValue,
  width: dimensionValue,
  style: strokeStyleValue,
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
      color: z.union([colorValue, z.string()]),
      width: z.union([dimensionValue, z.string()]),
      style: z.union([strokeStyleValue, z.string()]),
    }),
    z.string(), // token reference
  ]),
});

const TypographyValueSchema = z.object({
  fontFamily: fontFamilyValue,
  fontSize: dimensionValue,
  fontWeight: FontWeightValueSchema,
  letterSpacing: dimensionValue,
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
      fontFamily: z.union([fontFamilyValue, z.string()]),
      fontSize: z.union([dimensionValue, z.string()]),
      fontWeight: z.union([FontWeightValueSchema, z.string()]),
      letterSpacing: z.union([dimensionValue, z.string()]),
      lineHeight: z.union([z.number(), z.string()]),
    }),
    z.string(), // token reference
  ]),
});

const GradientPosition = z.number().min(0).max(1);

const GradientValueSchema = z.array(
  z.object({
    color: colorValue,
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
        color: z.union([colorValue, z.string()]),
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
