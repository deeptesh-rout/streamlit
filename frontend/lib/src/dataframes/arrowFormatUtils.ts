/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Field, Struct, StructRow, util } from "apache-arrow"
import trimEnd from "lodash/trimEnd"
import moment from "moment-timezone"
import numbro from "numbro"

import { logWarning } from "@streamlit/lib/src/util/log"
import {
  isNullOrUndefined,
  notNullOrUndefined,
} from "@streamlit/lib/src/util/utils"

import { DataType, getTypeName, Type } from "./arrowTypeUtils"

// The frequency strings defined in pandas.
// See: https://pandas.pydata.org/docs/user_guide/timeseries.html#period-aliases
// Not supported: "N" (nanoseconds), "U" & "us" (microseconds), and "B" (business days).
// Reason is that these types are not supported by moment.js, but also they are not
// very commonly used in practice.
type SupportedPandasOffsetType =
  // yearly frequency:
  | "A" // deprecated alias
  | "Y"
  // quarterly frequency:
  | "Q"
  // monthly frequency:
  | "M"
  // weekly frequency:
  | "W"
  // calendar day frequency:
  | "D"
  // hourly frequency:
  | "H" // deprecated alias
  | "h"
  // minutely frequency
  | "T" // deprecated alias
  | "min"
  // secondly frequency:
  | "S" // deprecated alias
  | "s"
  // milliseconds frequency:
  | "L" // deprecated alias
  | "ms"

type PeriodFrequency =
  | SupportedPandasOffsetType
  | `${SupportedPandasOffsetType}-${string}`
type PeriodType = `period[${PeriodFrequency}]`

const WEEKDAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
const formatMs = (duration: number): string =>
  moment("19700101", "YYYYMMDD")
    .add(duration, "ms")
    .format("YYYY-MM-DD HH:mm:ss.SSS")

const formatSec = (duration: number): string =>
  moment("19700101", "YYYYMMDD")
    .add(duration, "s")
    .format("YYYY-MM-DD HH:mm:ss")

const formatMin = (duration: number): string =>
  moment("19700101", "YYYYMMDD").add(duration, "m").format("YYYY-MM-DD HH:mm")

const formatHours = (duration: number): string =>
  moment("19700101", "YYYYMMDD").add(duration, "h").format("YYYY-MM-DD HH:mm")

const formatDay = (duration: number): string =>
  moment("19700101", "YYYYMMDD").add(duration, "d").format("YYYY-MM-DD")

const formatMonth = (duration: number): string =>
  moment("19700101", "YYYYMMDD").add(duration, "M").format("YYYY-MM")

const formatYear = (duration: number): string =>
  moment("19700101", "YYYYMMDD").add(duration, "y").format("YYYY")

const formatWeeks = (duration: number, freqParam?: string): string => {
  if (!freqParam) {
    throw new Error('Frequency "W" requires parameter')
  }
  const dayIndex = WEEKDAY_SHORT.indexOf(freqParam)
  if (dayIndex < 0) {
    throw new Error(
      `Invalid value: ${freqParam}. Supported values: ${JSON.stringify(
        WEEKDAY_SHORT
      )}`
    )
  }
  const startDate = moment("19700101", "YYYYMMDD")
    .add(duration, "w")
    .day(dayIndex - 6)
    .format("YYYY-MM-DD")
  const endDate = moment("19700101", "YYYYMMDD")
    .add(duration, "w")
    .day(dayIndex)
    .format("YYYY-MM-DD")

  return `${startDate}/${endDate}`
}

const formatQuarter = (duration: number): string =>
  moment("19700101", "YYYYMMDD")
    .add(duration, "Q")
    .endOf("quarter")
    .format("YYYY[Q]Q")

const PERIOD_TYPE_FORMATTERS: Record<
  SupportedPandasOffsetType,
  (duration: number, freqParam?: string) => string
> = {
  L: formatMs,
  ms: formatMs,
  S: formatSec,
  s: formatSec,
  T: formatMin,
  min: formatMin,
  H: formatHours,
  h: formatHours,
  D: formatDay,
  M: formatMonth,
  W: formatWeeks,
  Q: formatQuarter,
  Y: formatYear,
  A: formatYear,
}

/** Interval data type. */
interface Interval {
  left: number
  right: number
}

type IntervalData = "int64" | "uint64" | "float64" | "datetime64[ns]"
type IntervalClosed = "left" | "right" | "both" | "neither"
type IntervalType = `interval[${IntervalData}, ${IntervalClosed}]`

/** Formats an interval index. */
function formatIntervalType(data: StructRow, typeName: IntervalType): string {
  const match = typeName.match(/interval\[(.+), (both|left|right|neither)\]/)
  if (match === null) {
    throw new Error(`Invalid interval type: ${typeName}`)
  }
  const [, subtype, closed] = match
  return formatInterval(data, subtype, closed as IntervalClosed)
}

function formatInterval(
  data: StructRow,
  subtype: string,
  closed: IntervalClosed
): string {
  const interval = data.toJSON() as Interval

  const leftBracket = closed === "both" || closed === "left" ? "[" : "("
  const rightBracket = closed === "both" || closed === "right" ? "]" : ")"
  const leftInterval = format(interval.left, {
    pandas_type: subtype,
    numpy_type: subtype,
  })
  const rightInterval = format(interval.right, {
    pandas_type: subtype,
    numpy_type: subtype,
  })

  return `${leftBracket + leftInterval}, ${rightInterval + rightBracket}`
}

/**
 * Adjusts a time value to seconds based on the unit information in the field.
 *
 * The unit numbers are specified here:
 * https://github.com/apache/arrow/blob/3ab246f374c17a216d86edcfff7ff416b3cff803/js/src/enum.ts#L95
 */
export function convertToSeconds(
  value: number | bigint,
  unit: number
): number {
  let unitAdjustment

  if (unit === 1) {
    // Milliseconds
    unitAdjustment = 1000
  } else if (unit === 2) {
    // Microseconds
    unitAdjustment = 1000 * 1000
  } else if (unit === 3) {
    // Nanoseconds
    unitAdjustment = 1000 * 1000 * 1000
  } else {
    // Interpret it as seconds as a fallback
    return Number(value)
  }

  // Do the calculation based on bigints, if the value
  // is a bigint and not safe for usage as number.
  // This might lose some precision since it doesn't keep
  // fractional parts.
  if (typeof value === "bigint" && !Number.isSafeInteger(Number(value))) {
    return Number(value / BigInt(unitAdjustment))
  }

  return Number(value) / unitAdjustment
}

function formatTime(data: number, field?: Field): string {
  const timeInSeconds = convertToSeconds(data, field?.type?.unit ?? 0)
  return moment
    .unix(timeInSeconds)
    .utc()
    .format(timeInSeconds % 1 === 0 ? "HH:mm:ss" : "HH:mm:ss.SSS")
}

function formatDuration(data: number | bigint, field?: Field): string {
  return moment
    .duration(convertToSeconds(data, field?.type?.unit ?? 3), "seconds")
    .humanize()
}

/**
 * Formats a decimal value with a given scale to a string.
 *
 * This code is partly based on: https://github.com/apache/arrow/issues/35745
 *
 * TODO: This is only a temporary workaround until ArrowJS can format decimals correctly.
 * This is tracked here:
 * https://github.com/apache/arrow/issues/37920
 * https://github.com/apache/arrow/issues/28804
 * https://github.com/apache/arrow/issues/35745
 */
function formatDecimal(value: Uint32Array, scale: number): string {
  // Format Uint32Array to a numerical string and pad it with zeros
  // So that it is exactly the length of the scale.
  let numString = util.bigNumToString(new util.BN(value)).padStart(scale, "0")

  // ArrowJS 13 correctly adds a minus sign for negative numbers.
  // but it doesn't handle th fractional part yet. So we can just return
  // the value if scale === 0, but we need to do some additional processing
  // for the fractional part if scale > 0.

  if (scale === 0) {
    return numString
  }

  let sign = ""
  if (numString.startsWith("-")) {
    // Check if number is negative, and if so remember the sign and remove it.
    // We will add it back later.
    sign = "-"
    numString = numString.slice(1)
  }
  // Extract the whole number part. If the number is < 1, it doesn't
  // have a whole number part, so we'll use "0" instead.
  // E.g for 123450 with scale 3, we'll get "123" as the whole part.
  const wholePart = numString.slice(0, -scale) || "0"
  // Extract the fractional part and remove trailing zeros.
  // E.g. for 123450 with scale 3, we'll get "45" as the fractional part.
  const decimalPart = trimEnd(numString.slice(-scale), "0") || ""
  // Combine the parts and add the sign.
  return `${sign}${wholePart}` + (decimalPart ? `.${decimalPart}` : "")
}

export function formatPeriodType(
  duration: bigint,
  typeName: PeriodType
): string {
  const match = typeName.match(/period\[(.*)]/)
  if (match === null) {
    logWarning(`Invalid period type: ${typeName}`)
    return String(duration)
  }
  const [, freq] = match
  return formatPeriod(duration, freq as PeriodFrequency)
}

function formatPeriod(duration: bigint, freq: PeriodFrequency): string {
  const [freqName, freqParam] = freq.split("-", 2)
  const momentConverter =
    PERIOD_TYPE_FORMATTERS[freqName as SupportedPandasOffsetType]
  if (!momentConverter) {
    logWarning(`Unsupported period frequency: ${freq}`)
    return String(duration)
  }
  const durationNumber = Number(duration)
  if (!Number.isSafeInteger(durationNumber)) {
    logWarning(
      `Unsupported value: ${duration}. Supported values: [${Number.MIN_SAFE_INTEGER}-${Number.MAX_SAFE_INTEGER}]`
    )
    return String(duration)
  }
  return momentConverter(durationNumber, freqParam)
}

function formatCategoricalType(
  x: number | bigint | StructRow,
  field: Field
): string {
  // Serialization for pandas.Interval and pandas.Period is provided by Arrow extensions
  // https://github.com/pandas-dev/pandas/blob/235d9009b571c21b353ab215e1e675b1924ae55c/
  // pandas/core/arrays/arrow/extension_types.py#L17
  const extensionName = field.metadata.get("ARROW:extension:name")
  if (extensionName) {
    const extensionMetadata = JSON.parse(
      field.metadata.get("ARROW:extension:metadata") as string
    )
    if (extensionName === "pandas.interval") {
      const { subtype, closed } = extensionMetadata
      return formatInterval(x as StructRow, subtype, closed)
    }
    if (extensionName === "pandas.Period") {
      const { freq } = extensionMetadata
      return formatPeriod(x as bigint, freq)
    }
  }
  return String(x)
}

/** Takes the data and it's type and nicely formats it. */
export function format(x: DataType, type?: Type, field?: Field): string {
  const typeName = type && getTypeName(type)

  if (isNullOrUndefined(x)) {
    return "<NA>"
  }

  // date
  const isDate = x instanceof Date || Number.isFinite(x)
  if (isDate && typeName === "date") {
    return moment.utc(x as Date | number).format("YYYY-MM-DD")
  }
  // time
  if (typeof x === "bigint" && typeName === "time") {
    return formatTime(Number(x), field)
  }

  // datetimetz
  if (isDate && typeName === "datetimetz") {
    const meta = type?.meta
    let datetime = moment(x as Date | number)

    if (meta?.timezone) {
      if (moment.tz.zone(meta?.timezone)) {
        // uses timezone notation
        datetime = datetime.tz(meta?.timezone)
      } else {
        // uses UTC offset notation
        datetime = datetime.utcOffset(meta?.timezone)
      }
    }

    return datetime.format("YYYY-MM-DD HH:mm:ssZ")
  }
  // datetime, datetime64, datetime64[ns], etc.
  if (isDate && typeName?.startsWith("datetime")) {
    return moment.utc(x as Date | number).format("YYYY-MM-DD HH:mm:ss")
  }

  if (typeName?.startsWith("interval")) {
    return formatIntervalType(x as StructRow, typeName as IntervalType)
  }

  if (typeName?.startsWith("period")) {
    return formatPeriodType(x as bigint, typeName as PeriodType)
  }

  if (typeName === "categorical") {
    return formatCategoricalType(
      x as number | bigint | StructRow,
      field as Field
    )
  }

  if (typeName?.startsWith("timedelta")) {
    return formatDuration(x as number | bigint, field)
  }

  if (typeName === "decimal") {
    return formatDecimal(x as Uint32Array, field?.type?.scale || 0)
  }

  // Nested arrays and objects.
  if (typeName === "object" || typeName?.startsWith("list")) {
    if (field?.type instanceof Struct) {
      // This type is used by python dictionary values

      // Workaround: Arrow JS adds all properties from all cells
      // as fields. When you convert to string, it will contain lots of fields with
      // null values. To mitigate this, we filter out null values.

      return JSON.stringify(x, (_key, value) => {
        if (!notNullOrUndefined(value)) {
          // Ignore null and undefined values ->
          return undefined
        }
        if (typeof value === "bigint") {
          return Number(value)
        }
        return value
      })
    }
    return JSON.stringify(x, (_key, value) =>
      typeof value === "bigint" ? Number(value) : value
    )
  }

  if (typeName === "float64" && Number.isFinite(x)) {
    return numbro(x).format("0,0.0000")
  }

  return String(x)
}
