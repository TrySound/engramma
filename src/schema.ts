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

// Node reference using node ID instead of dot-separated path
// Used in RawValue to enable fast reference resolution
export const nodeRefSchema = z.object({
  ref: z.string(),
});

export type NodeRef = z.infer<typeof nodeRefSchema>;

export const isNodeRef = (value: unknown): value is NodeRef =>
  nodeRefSchema.safeParse(value).success;

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
    duration: z.union([durationValue, nodeRefSchema]),
    delay: z.union([durationValue, nodeRefSchema]),
    timingFunction: z.union([cubicBezierValue, nodeRefSchema]),
  }),
});

const shadowItemSchema = z.object({
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
  color: z.union([colorValue, nodeRefSchema]),
  offsetX: z.union([dimensionValue, nodeRefSchema]),
  offsetY: z.union([dimensionValue, nodeRefSchema]),
  blur: z.union([dimensionValue, nodeRefSchema]),
  spread: z.union([dimensionValue, nodeRefSchema]),
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
    color: z.union([colorValue, nodeRefSchema]),
    width: z.union([dimensionValue, nodeRefSchema]),
    style: z.union([strokeStyleValue, nodeRefSchema]),
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
    fontFamily: z.union([fontFamilyValue, nodeRefSchema]),
    fontSize: z.union([dimensionValue, nodeRefSchema]),
    fontWeight: z.union([fontWeightValue, nodeRefSchema]),
    letterSpacing: z.union([dimensionValue, nodeRefSchema]),
    lineHeight: z.union([z.number(), nodeRefSchema]),
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
      color: z.union([colorValue, nodeRefSchema]),
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
  ? Omit<T, "value"> & { value: V | NodeRef }
  : T;
export type RawValueWithReference = WithReference<RawValue>;

/* make sure Value and Raw Value are in sync */
(({}) as unknown as Value)["type"] satisfies RawValue["type"];
(({}) as unknown as RawValue)["type"] satisfies Value["type"];
