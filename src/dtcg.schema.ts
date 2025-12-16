// Zod schema based on Design Tokens Community Group specification
// does not support JSON Pointer references

import { z } from "zod";

// token name does not start with $ with the only exception for $root
export const nameSchema = z.string().regex(/^[a-zA-Z0-9_][a-zA-Z0-9_$-]*$/);

// references use dot-separated paths with curly braces like {colors.primary}
// should match $root token
export const referenceSchema = z
  .string()
  .regex(/^\{[a-zA-Z0-9_$][a-zA-Z0-9_$-]*(\.[a-zA-Z0-9_$][a-zA-Z0-9_$-]*)*\}$/);

// Token types
const tokenType = z.enum([
  "color",
  "dimension",
  "fontFamily",
  "fontWeight",
  "duration",
  "cubicBezier",
  "number",
  "strokeStyle",
  "border",
  "transition",
  "shadow",
  "gradient",
  "typography",
]);

// primitive token values

const colorComponent = z.union([z.number(), z.literal("none")]);

const colorSpace = z.enum([
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

export const colorValue = z.object({
  colorSpace: colorSpace,
  components: z.array(colorComponent),
  alpha: z.number().optional(),
  hex: z.string().optional(),
});

export const dimensionValue = z.object({
  value: z.number(),
  unit: z.enum(["px", "rem"]),
});

export const fontFamilyValue = z.union([
  z.string(),
  z.array(z.string()).min(1),
]);

export const fontWeightValue = z.union([
  z.number().min(1).max(1000),
  z.enum([
    "thin",
    "hairline",
    "extra-light",
    "ultra-light",
    "light",
    "normal",
    "regular",
    "book",
    "medium",
    "semi-bold",
    "demi-bold",
    "bold",
    "extra-bold",
    "ultra-bold",
    "black",
    "heavy",
    "extra-black",
    "ultra-black",
  ]),
]);

export const durationValue = z.object({
  value: z.number(),
  unit: z.enum(["ms", "s"]),
});

export const cubicBezierValue = z.tuple([
  z.number(),
  z.number(),
  z.number(),
  z.number(),
]);

export const numberValue = z.number();

export const strokeStyleValue = z.union([
  z.enum([
    "solid",
    "dashed",
    "dotted",
    "double",
    "groove",
    "ridge",
    "outset",
    "inset",
  ]),
  z.object({
    dashArray: z.array(dimensionValue).min(1),
    lineCap: z.enum(["round", "butt", "square"]),
  }),
]);

// composite token values

export const borderValue = z.object({
  color: z.union([colorValue, referenceSchema]),
  width: z.union([dimensionValue, referenceSchema]),
  style: z.union([strokeStyleValue, referenceSchema]),
});

export const transitionValue = z.object({
  duration: z.union([durationValue, referenceSchema]),
  delay: z.union([durationValue, referenceSchema]),
  timingFunction: z.union([cubicBezierValue, referenceSchema]),
});

const shadowObject = z.object({
  color: z.union([colorValue, referenceSchema]),
  offsetX: z.union([dimensionValue, referenceSchema]),
  offsetY: z.union([dimensionValue, referenceSchema]),
  blur: z.union([dimensionValue, referenceSchema]),
  spread: z.union([dimensionValue, referenceSchema]),
  inset: z.boolean().optional(),
});

export const shadowValue = z.union([
  shadowObject,
  z.array(shadowObject).min(1),
]);

const gradientStop = z.object({
  color: z.union([colorValue, referenceSchema]),
  position: z.number(),
});

export const gradientValue = z.array(gradientStop).min(1);

export const typographyValue = z.object({
  fontFamily: z.union([fontFamilyValue, referenceSchema]),
  fontSize: z.union([dimensionValue, referenceSchema]),
  fontWeight: z.union([fontWeightValue, referenceSchema]),
  letterSpacing: z.union([dimensionValue, referenceSchema]),
  lineHeight: z.union([numberValue, referenceSchema]),
});

export const tokenSchema = z.object({
  $value: z.union([
    colorValue,
    dimensionValue,
    fontFamilyValue,
    fontWeightValue,
    durationValue,
    cubicBezierValue,
    numberValue,
    strokeStyleValue,
    borderValue,
    transitionValue,
    shadowValue,
    gradientValue,
    typographyValue,
    referenceSchema,
  ]),
  $type: tokenType.optional(),
  $description: z.string().optional(),
  $extensions: z.record(z.string(), z.unknown()).optional(),
  $deprecated: z.union([z.boolean(), z.string()]).optional(),
});

export const groupSchema = z.object({
  $type: tokenType.optional(),
  $description: z.string().optional(),
  $extensions: z.record(z.string(), z.unknown()).optional(),
  $extends: referenceSchema.optional(),
  $deprecated: z.union([z.boolean(), z.string()]).optional(),
  $root: tokenSchema.optional(),
});

export type Token = z.infer<typeof tokenSchema>;
export type Group = z.infer<typeof groupSchema>;
export type TokenType = z.infer<typeof tokenType>;
export type ColorValue = z.infer<typeof colorValue>;
export type DimensionValue = z.infer<typeof dimensionValue>;
export type FontFamilyValue = z.infer<typeof fontFamilyValue>;
export type FontWeightValue = z.infer<typeof fontWeightValue>;
export type DurationValue = z.infer<typeof durationValue>;
export type CubicBezierValue = z.infer<typeof cubicBezierValue>;
export type StrokeStyleValue = z.infer<typeof strokeStyleValue>;
export type BorderValue = z.infer<typeof borderValue>;
export type TransitionValue = z.infer<typeof transitionValue>;
export type ShadowValue = z.infer<typeof shadowValue>;
export type GradientValue = z.infer<typeof gradientValue>;
export type TypographyValue = z.infer<typeof typographyValue>;
