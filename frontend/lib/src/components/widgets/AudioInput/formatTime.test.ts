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

import timezoneMock from "timezone-mock"

import formatTime from "./formatTime"

describe("formatTime", () => {
  describe("US/Pacific Timezone", () => {
    beforeAll(() => {
      timezoneMock.register("US/Pacific")
    })

    afterAll(() => {
      timezoneMock.unregister()
    })

    it('should format 0 milliseconds as "00:00" in Pacific Time', () => {
      expect(formatTime(0)).toBe("00:00")
    })

    it('should format 1000 milliseconds as "00:01" in Pacific Time', () => {
      expect(formatTime(1000)).toBe("00:01")
    })

    it('should format 90000 milliseconds as "01:30" in Pacific Time', () => {
      expect(formatTime(90000)).toBe("01:30")
    })
  })

  describe("US/Eastern Timezone", () => {
    beforeAll(() => {
      timezoneMock.register("US/Eastern")
    })

    afterAll(() => {
      timezoneMock.unregister()
    })

    it('should format 0 milliseconds as "00:00" in Eastern Time', () => {
      expect(formatTime(0)).toBe("00:00")
    })

    it('should format 1000 milliseconds as "00:01" in Eastern Time', () => {
      expect(formatTime(1000)).toBe("00:01")
    })

    it('should format 90000 milliseconds as "01:30" in Eastern Time', () => {
      expect(formatTime(90000)).toBe("01:30")
    })
  })

  describe("Australia/Adelaide Timezone", () => {
    beforeAll(() => {
      timezoneMock.register("Australia/Adelaide")
    })

    afterAll(() => {
      timezoneMock.unregister()
    })

    it('should format 0 milliseconds as "00:00" in Adelaide Time', () => {
      expect(formatTime(0)).toBe("00:00")
    })

    it('should format 1000 milliseconds as "00:01" in Adelaide Time', () => {
      expect(formatTime(1000)).toBe("00:01")
    })

    it('should format 90000 milliseconds as "01:30" in Adelaide Time', () => {
      expect(formatTime(90000)).toBe("01:30")
    })
  })
})
