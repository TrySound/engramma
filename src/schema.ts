import { z } from "zod";
import {
  colorValue,
  cubicBezierValue,
  dimensionValue,
  durationValue,
  fontFamilyValue,
  fontWeightValue,
  numberValue,
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

const colorSchema = z.object({
  type: z.literal("color"),
  value: colorValue,
});

const dimensionSchema = z.object({
  type: z.literal("dimension"),
  value: dimensionValue,
});

const durationSchema = z.object({
  type: z.literal("duration"),
  value: durationValue,
});

const numberSchema = z.object({
  type: z.literal("number"),
  value: numberValue,
});

const cubicBezierSchema = z.object({
  type: z.literal("cubicBezier"),
  value: cubicBezierValue,
});

const fontFamilySchema = z.object({
  type: z.literal("fontFamily"),
  value: fontFamilyValue,
});

const fontWeightSchema = z.object({
  type: z.literal("fontWeight"),
  value: fontWeightValue,
});

const strokeStyleSchema = z.object({
  type: z.literal("strokeStyle"),
  value: strokeStyleValue,
});

const transitionSchema = z.object({
  type: z.literal("transition"),
  value: z.object({
    duration: durationValue,
    delay: durationValue,
    timingFunction: cubicBezierValue,
  }),
});

const rawTransitionSchema = z.object({
  type: z.literal("transition"),
  value: z.object({
    duration: z.union([durationValue, z.string()]),
    delay: z.union([durationValue, z.string()]),
    timingFunction: z.union([cubicBezierValue, z.string()]),
  }),
});

export const shadowItemSchema = z.object({
  color: colorValue,
  offsetX: dimensionValue,
  offsetY: dimensionValue,
  blur: dimensionValue,
  spread: dimensionValue,
  inset: z.boolean().optional(),
});

const shadowSchema = z.object({
  type: z.literal("shadow"),
  value: z.array(shadowItemSchema),
});

const rawShadowItemSchema = z.object({
  color: z.union([colorValue, z.string()]),
  offsetX: z.union([dimensionValue, z.string()]),
  offsetY: z.union([dimensionValue, z.string()]),
  blur: z.union([dimensionValue, z.string()]),
  spread: z.union([dimensionValue, z.string()]),
  inset: z.boolean().optional(),
});

const rawShadowSchema = z.object({
  type: z.literal("shadow"),
  value: z.array(rawShadowItemSchema),
});

const borderSchema = z.object({
  type: z.literal("border"),
  value: z.object({
    color: colorValue,
    width: dimensionValue,
    style: strokeStyleValue,
  }),
});

const rawBorderSchema = z.object({
  type: z.literal("border"),
  value: z.object({
    color: z.union([colorValue, z.string()]),
    width: z.union([dimensionValue, z.string()]),
    style: z.union([strokeStyleValue, z.string()]),
  }),
});

const typographySchema = z.object({
  type: z.literal("typography"),
  value: z.object({
    fontFamily: fontFamilyValue,
    fontSize: dimensionValue,
    fontWeight: fontWeightValue,
    letterSpacing: dimensionValue,
    lineHeight: z.number(),
  }),
});

const rawTypographySchema = z.object({
  type: z.literal("typography"),
  value: z.object({
    fontFamily: z.union([fontFamilyValue, z.string()]),
    fontSize: z.union([dimensionValue, z.string()]),
    fontWeight: z.union([fontWeightValue, z.string()]),
    letterSpacing: z.union([dimensionValue, z.string()]),
    lineHeight: z.union([z.number(), z.string()]),
  }),
});

const gradientSchema = z.object({
  type: z.literal("gradient"),
  value: z.array(
    z.object({
      color: colorValue,
      position: z.number(),
    }),
  ),
});

const rawGradientSchema = z.object({
  type: z.literal("gradient"),
  value: z.array(
    z.object({
      color: z.union([colorValue, z.string()]),
      position: z.number(),
    }),
  ),
});

export const ValueSchema = z.union([
  // primitive tokens
  colorSchema,
  dimensionSchema,
  durationSchema,
  cubicBezierSchema,
  numberSchema,
  fontFamilySchema,
  fontWeightSchema,
  strokeStyleSchema,
  // composite tokens
  transitionSchema,
  shadowSchema,
  borderSchema,
  typographySchema,
  gradientSchema,
]);

export const RawValueSchema = z.union([
  // primitive tokens
  colorSchema,
  dimensionSchema,
  durationSchema,
  cubicBezierSchema,
  numberSchema,
  fontFamilySchema,
  fontWeightSchema,
  strokeStyleSchema,
  // composite tokens
  rawTransitionSchema,
  rawShadowSchema,
  rawBorderSchema,
  rawTypographySchema,
  rawGradientSchema,
]);

export type TransitionValue = z.infer<typeof transitionSchema>["value"];
export type ShadowItem = z.infer<typeof shadowItemSchema>;
export type ShadowValue = z.infer<typeof shadowSchema>["value"];
export type BorderValue = z.infer<typeof borderSchema>["value"];
export type TypographyValue = z.infer<typeof typographySchema>["value"];
export type GradientValue = z.infer<typeof gradientSchema>["value"];

export type RawTransitionValue = z.infer<typeof rawTransitionSchema>["value"];
export type RawShadowItem = z.infer<typeof rawShadowItemSchema>;
export type RawShadowValue = z.infer<typeof rawShadowSchema>["value"];
export type RawBorderValue = z.infer<typeof rawBorderSchema>["value"];
export type RawTypographyValue = z.infer<typeof rawTypographySchema>["value"];
export type RawGradientValue = z.infer<typeof rawGradientSchema>["value"];

export type Value = z.infer<typeof ValueSchema>;
export type RawValue = z.infer<typeof RawValueSchema>;

// add token reference to RawValue value field
// to make TokenMeta type and value co-located
type WithReference<T> = T extends { value: infer V }
  ? Omit<T, "value"> & { value: V | string }
  : T;
export type RawValueWithReference = WithReference<RawValue>;

/* make sure Value and Raw Value are in sync */
(({}) as unknown as Value)["type"] satisfies RawValue["type"];
(({}) as unknown as RawValue)["type"] satisfies Value["type"];
