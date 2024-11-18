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

import styled, { CSSObject } from "@emotion/styled"

import { EmotionTheme } from "@streamlit/lib/src/theme"

export const StyledTableContainer = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.md,
  fontFamily: theme.genericFonts.bodyFont,
  lineHeight: theme.lineHeights.small,
  overflow: ["auto", "overlay"],
}))

export const StyledTable = styled.table(({ theme }) => ({
  width: theme.sizes.full,
  marginBottom: theme.spacing.lg,
  color: theme.colors.bodyText,
  // Prevent double borders
  borderCollapse: "collapse",
  captionSide: "bottom",
  border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColorLight}`,
  "& caption": {
    fontFamily: theme.genericFonts.bodyFont,
    fontSize: theme.fontSizes.sm,
    paddingTop: theme.spacing.sm,
    paddingBottom: 0,
    color: theme.colors.fadedText60,
    textAlign: "left",
    wordWrap: "break-word",
  },
}))

const styleCellFunction = (theme: EmotionTheme): CSSObject => ({
  borderBottom: `${theme.sizes.borderWidth} solid ${theme.colors.borderColorLight}`,
  borderRight: `${theme.sizes.borderWidth} solid ${theme.colors.borderColorLight}`,
  verticalAlign: "middle",
  padding: `${theme.spacing.twoXS} ${theme.spacing.xs}`,
  fontWeight: theme.fontWeights.normal,
})

export const StyledTableCell = styled.td(({ theme }) =>
  styleCellFunction(theme)
)
export const StyledTableCellHeader = styled.th(({ theme }) => ({
  ...styleCellFunction(theme),
  textAlign: "inherit",
  color: theme.colors.fadedText60,
}))

export const StyledEmptyTableCell = styled(StyledTableCell)(({ theme }) => ({
  color: theme.colors.darkGray,
  fontStyle: "italic",
  fontSize: theme.fontSizes.md,
  textAlign: "center",
}))
