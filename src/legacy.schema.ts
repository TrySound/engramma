// Zod schema based on Design Tokens Community Group specification
// Supports dual-format parsing: legacy 2022 format and 2025 standard format
// Output is always normalized to 2025 standard format

import { z } from "zod";
import { parseColor } from "./color";
import {
  cubicBezierValue,
  fontFamilyValue,
  fontWeightValue,
  referenceSchema,
  strokeStyleString,
  tokenSchema,
  type ColorValue,
  type DimensionValue,
  type DurationValue,
} from "./dtcg.schema";

// Expand 3-digit and 4-digit hex shortcuts: #rgb -> #rrggbb, #rgba -> #rrggbbaa
const expandShorthandHex = (hex: string): string => {
  if (hex.length === 4 && hex.startsWith("#")) {
    // #RGB -> #RRGGBB
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  if (hex.length === 5 && hex.startsWith("#")) {
    // #RGBA -> #RRGGBBAA
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}${hex[4]}${hex[4]}`;
  }
  return hex;
};

// #rrggbb or #rrggbbaa or #rgb or #rgba
const legacyColorRegex =
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/i;
const legacyColorValue = z
  .string()
  .regex(legacyColorRegex)
  .transform((value): ColorValue => {
    const expanded = expandShorthandHex(value.toLowerCase());
    // Extract alpha from last 2 chars if present
    let alphaHex = "ff";
    let cleanHex = expanded;
    if (expanded.length === 9) {
      // #rrggbbaa format
      alphaHex = expanded.slice(-2);
      cleanHex = expanded.slice(0, 7);
    }
    // Parse RGB using existing parseColor() for consistency
    const colorValue = parseColor(cleanHex);
    // Extract alpha and round to 2 decimals
    if (alphaHex !== "ff") {
      const alpha = Math.round((parseInt(alphaHex, 16) / 255) * 100) / 100;
      colorValue.alpha = alpha;
      // Don't include hex when alpha is present (non-opaque)
      delete colorValue.hex;
    }
    return colorValue;
  });

// "10px", "0.5rem", "-8px", "-0.5rem"
const dimensionRegex = /^(-?\d+(?:\.\d+)?)(px|rem)$/;
const legacyDimensionValue = z
  .string()
  .regex(dimensionRegex)
  .transform((value): DimensionValue => {
    const match = value.match(dimensionRegex);
    if (!match) {
      throw new Error(`Invalid dimension: ${value}`);
    }
    return {
      value: Number.parseFloat(match[1]),
      unit: match[2] as "px" | "rem",
    };
  });

// "200ms", "1.5s", "-100ms", "-0.5s"
const durationRegex = /^(-?\d+(?:\.\d+)?)(ms|s)$/;
const legacyDurationValue = z
  .string()
  .regex(durationRegex)
  .transform((value): DurationValue => {
    const match = value.match(durationRegex);
    if (!match) {
      throw new Error(`Invalid duration: ${value}`);
    }
    return {
      value: Number.parseFloat(match[1]),
      unit: match[2] as "ms" | "s",
    };
  });

// "200", "1.5", "-42", "-3.14"
const numberRegex = /^(-?\d+(?:\.\d+)?)$/;
const legacyNumberValue = z
  .string()
  .regex(numberRegex)
  .transform((value): number => {
    const match = value.match(numberRegex);
    if (!match) {
      throw new Error(`Invalid number: ${value}`);
    }
    return Number.parseFloat(match[1]);
  });

const legacyStrokeStyleValue = z.union([
  strokeStyleString,
  z.object({
    dashArray: z.array(legacyDimensionValue).min(1),
    lineCap: z.enum(["round", "butt", "square"]),
  }),
]);

const legacyShadowObject = z.object({
  inset: z.boolean().optional(),
  color: z.union([legacyColorValue, referenceSchema]),
  offsetX: z.union([legacyDimensionValue, referenceSchema]),
  offsetY: z.union([legacyDimensionValue, referenceSchema]),
  blur: z.union([legacyDimensionValue, referenceSchema]),
  spread: z.union([legacyDimensionValue, referenceSchema]),
});

const legacyShadowValue = z.union([
  z.array(legacyShadowObject),
  legacyShadowObject,
]);

const legacyBorderValue = z.object({
  color: z.union([legacyColorValue, referenceSchema]),
  width: z.union([legacyDimensionValue, referenceSchema]),
  style: z.union([legacyStrokeStyleValue, referenceSchema]),
});

const legacyTransitionValue = z.object({
  duration: z.union([legacyDurationValue, referenceSchema]),
  delay: z.union([legacyDurationValue, referenceSchema]),
  timingFunction: z.union([cubicBezierValue, referenceSchema]),
});

const legacyGradientStop = z.object({
  color: z.union([legacyColorValue, referenceSchema]),
  position: z.number(),
});
const legacyGradientValue = z.array(legacyGradientStop).min(1);

const legacyTypographyValue = z.object({
  fontFamily: z.union([fontFamilyValue, referenceSchema]),
  fontSize: z.union([legacyDimensionValue, referenceSchema]),
  fontWeight: z.union([fontWeightValue, referenceSchema]),
  letterSpacing: z.union([legacyDimensionValue, referenceSchema]),
  lineHeight: z.union([legacyNumberValue, referenceSchema]),
});

export const legacyTokenSchema = tokenSchema.extend({
  $value: z.union([
    legacyColorValue,
    legacyDimensionValue,
    legacyDurationValue,
    legacyStrokeStyleValue,
    legacyBorderValue,
    legacyTransitionValue,
    legacyShadowValue,
    legacyGradientValue,
    legacyTypographyValue,
  ]),
});

export const backwardCompatibleTokenSchema = z.union([
  legacyTokenSchema,
  tokenSchema,
]);
