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

import {
  buildHttpUri,
  buildWsUri,
  getPossibleBaseUris,
  getWindowBaseUriParts,
  isValidOrigin,
} from "./UriUtil"

const location: Partial<Location> = {}

global.window = Object.create(window)
Object.defineProperty(window, "location", { value: location })

test("gets all window URI parts", () => {
  location.hostname = "the_host"
  location.port = "9988"
  location.pathname = "foo"

  const parts = getWindowBaseUriParts()
  expect(parts).toStrictEqual({
    host: "the_host",
    port: 9988,
    basePath: "foo",
  })
})

test("gets window URI parts without basePath", () => {
  location.hostname = "the_host"
  location.port = "9988"
  location.pathname = ""

  const parts = getWindowBaseUriParts()
  expect(parts).toStrictEqual({
    host: "the_host",
    port: 9988,
    basePath: "",
  })
})

test("gets window URI parts with long basePath", () => {
  location.hostname = "the_host"
  location.port = "9988"
  location.pathname = "/foo/bar"

  const parts = getWindowBaseUriParts()
  expect(parts).toStrictEqual({
    host: "the_host",
    port: 9988,
    basePath: "foo/bar",
  })
})

test("gets window URI parts with weird basePath", () => {
  location.hostname = "the_host"
  location.port = "9988"
  location.pathname = "///foo/bar//"

  const parts = getWindowBaseUriParts()
  expect(parts).toStrictEqual({
    host: "the_host",
    port: 9988,
    basePath: "foo/bar",
  })
})

test("builds HTTP URI correctly", () => {
  location.href = "http://something"
  const uri = buildHttpUri(
    {
      host: "the_host",
      port: 9988,
      basePath: "foo/bar",
    },
    "baz"
  )
  expect(uri).toBe("http://the_host:9988/foo/bar/baz")
})

test("builds HTTPS URI correctly", () => {
  location.href = "https://something"
  const uri = buildHttpUri(
    {
      host: "the_host",
      port: 9988,
      basePath: "foo/bar",
    },
    "baz"
  )
  expect(uri).toBe("https://the_host:9988/foo/bar/baz")
})

test("builds HTTP URI with no base path", () => {
  location.href = "http://something"
  const uri = buildHttpUri(
    {
      host: "the_host",
      port: 9988,
      basePath: "",
    },
    "baz"
  )
  expect(uri).toBe("http://the_host:9988/baz")
})

test("builds WS URI correctly", () => {
  location.href = "http://something"
  const uri = buildWsUri(
    {
      host: "the_host",
      port: 9988,
      basePath: "foo/bar",
    },
    "baz"
  )
  expect(uri).toBe("ws://the_host:9988/foo/bar/baz")
})

test("builds WSS URI correctly", () => {
  location.href = "https://something"
  const uri = buildWsUri(
    {
      host: "the_host",
      port: 9988,
      basePath: "foo/bar",
    },
    "baz"
  )
  expect(uri).toBe("wss://the_host:9988/foo/bar/baz")
})

test("builds WS URI with no base path", () => {
  location.href = "http://something"
  const uri = buildWsUri(
    {
      host: "the_host",
      port: 9988,
      basePath: "",
    },
    "baz"
  )
  expect(uri).toBe("ws://the_host:9988/baz")
})

describe("isValidOrigin", () => {
  it("returns false if allowedOrigin is invalid", () => {
    // allowedOrigin doesn't have a protocol
    expect(
      isValidOrigin("devel.streamlit.io", "http://devel.streamlit.io")
    ).toBe(false)
  })

  it("returns false if testOrigin is invalid", () => {
    // testOrigin doesn't have a protocol
    expect(
      isValidOrigin("http://devel.streamlit.io", "devel.streamlit.io")
    ).toBe(false)
  })

  it("returns true if testUrl's hostname is localhost w/ various ports", () => {
    expect(
      isValidOrigin(
        "http://localhost",
        // Example of localhost url used for manual testing
        "http://localhost:8000"
      )
    ).toBe(true)

    expect(
      isValidOrigin(
        "http://localhost",
        // Example of localhost url used by e2e test
        "http://localhost:35475"
      )
    ).toBe(true)
  })

  it("returns false if testUrl's hostname is localhost but protocol doesn't match", () => {
    expect(isValidOrigin("http://localhost", "https://localhost")).toBe(false)

    expect(
      isValidOrigin("https://localhost:8000", "http://localhost:8000")
    ).toBe(false)

    expect(
      isValidOrigin(
        "https:localhost",
        // Example of localhost url used for manual testing
        "http://localhost:8000"
      )
    ).toBe(false)

    expect(
      isValidOrigin(
        "http://localhost",
        // Example of localhost url used by e2e test
        "https://localhost:35475"
      )
    ).toBe(false)
  })

  it("returns false if protocols don't match", () => {
    expect(
      isValidOrigin("https://devel.streamlit.io", "http://devel.streamlit.io")
    ).toBe(false)
  })

  it("returns false if ports don't match", () => {
    expect(
      isValidOrigin(
        "https://devel.streamlit.io:8080",
        "https://devel.streamlit.io"
      )
    ).toBe(false)
  })

  it("returns true when the pattern and url are the same", () => {
    expect(
      isValidOrigin("http://devel.streamlit.io", "http://devel.streamlit.io")
    ).toBe(true)
  })

  it("returns true when the pattern and url are the same for localhost", () => {
    expect(
      isValidOrigin("http://localhost:3000", "http://localhost:3000")
    ).toBe(true)
  })

  it("should recognize wildcards in Firefox", () => {
    // In Firefox, the URL constructor crashes on URLs containing `*`,
    // for example `new URL("https://*.streamlit.app"). This used to not
    // allow to receive messages from Cloud Community apps. Make sure this
    // issue is fixed.
    const OrigURL = globalThis.URL
    try {
      globalThis.URL = function (url: string, ...rest: any[]) {
        if (url.includes("*")) {
          throw new Error("Invalid URL")
        }
        return new OrigURL(url, ...rest)
      } as any
      expect(
        isValidOrigin(
          "https://*.streamlit.app",
          "https://example.streamlit.app"
        )
      ).toBe(true)
    } finally {
      globalThis.URL = OrigURL
    }
  })

  describe("pattern matching", () => {
    it("handles the '*.' pattern", () => {
      expect(isValidOrigin("https://*.com", "https://a.com")).toBe(true)
      expect(isValidOrigin("https://*.a.com", "https://asd.a.com")).toBe(true)
      expect(
        isValidOrigin("https://www.*.a.com", "https://www.asd.a.com")
      ).toBe(true)
      expect(
        isValidOrigin("https://abc.*.*.a.com", "https://abc.def.xyz.a.com")
      ).toBe(true)
      expect(
        isValidOrigin("https://*.com", "https://example.example.com")
      ).toBe(true)

      expect(isValidOrigin("https://*.b.com", "https://www.c.com")).toBe(false)
    })

    it("handles the '{*.}?' pattern", () => {
      expect(
        isValidOrigin("https://{*.}?example.com", "https://cdn.example.com")
      ).toBe(true)
      expect(
        isValidOrigin("https://{*.}?example.com", "https://example.com")
      ).toBe(true)

      expect(
        isValidOrigin("https://{*.}?example.com", "https://www-example.com")
      ).toBe(false)
    })

    it("handles the '{cdn.}?' pattern", () => {
      expect(
        isValidOrigin("https://{cdn.}?example.com", "https://cdn.example.com")
      ).toBe(true)
      expect(
        isValidOrigin("https://{cdn.}?example.com", "https://example.com")
      ).toBe(true)

      expect(
        isValidOrigin("https://{cdn.}?example.com", "https://www.example.com")
      ).toBe(false)
      expect(
        isValidOrigin("https://{cdn.}?example.com", "https://cdn-example.com")
      ).toBe(false)
    })

    it("handles the '{www.cdn.}?' pattern", () => {
      expect(
        isValidOrigin(
          "https://{www.cdn.}?example.com",
          "https://www.cdn.example.com"
        )
      ).toBe(true)
      expect(
        isValidOrigin("https://{www.cdn.}?example.com", "https://example.com")
      ).toBe(true)

      expect(
        isValidOrigin(
          "https://{www.cdn.}?example.com",
          "https://cdn.example.com"
        )
      ).toBe(false)
      expect(
        isValidOrigin(
          "https://{www.cdn.}?example.com",
          "https://www.example.com"
        )
      ).toBe(false)
      expect(
        isValidOrigin(
          "https://{www.cdn.}?example.com",
          "https://www.cdn-example.com"
        )
      ).toBe(false)
    })

    it("handles the 'cdn-*' pattern", () => {
      expect(
        isValidOrigin(
          "https://cdn-*.example.com",
          "https://cdn-123.example.com"
        )
      ).toBe(true)
      expect(
        isValidOrigin("https://cdn-*.example.com", "https://cdn-.example.com")
      ).toBe(true)

      expect(
        isValidOrigin(
          "https://cdn-*.example.com",
          "https://cdn.123.example.com"
        )
      ).toBe(false)
      expect(
        isValidOrigin("https://cdn-*.example.com", "https://cdn.example.com")
      ).toBe(false)
    })

    it("handles the ':id' pattern", () => {
      expect(
        isValidOrigin(
          "https://cdn-:id.example.com",
          "https://cdn-123.example.com"
        )
      ).toBe(true)

      expect(
        isValidOrigin(
          "https://cdn-:id.example.com",
          "https://cdn-.example.com"
        )
      ).toBe(false)
      expect(
        isValidOrigin(
          "https://cdn-:id.example.com",
          "https://cdn.123.example.com"
        )
      ).toBe(false)
      expect(
        isValidOrigin("https://cdn-:id.example.com", "https://cdn.example.com")
      ).toBe(false)
    })

    it("handles regex patterns", () => {
      expect(
        isValidOrigin(
          "https://(cdn|www).example.com",
          "https://cdn.example.com"
        )
      ).toBe(true)
      expect(
        isValidOrigin(
          "https://(cdn|www).example.com",
          "https://www.example.com"
        )
      ).toBe(true)
      expect(isValidOrigin("https://(\\w+).com", "https://example.com")).toBe(
        true
      )

      expect(
        isValidOrigin(
          "https://(cdn|www).example.com",
          "https://dev.example.com"
        )
      ).toBe(false)
      expect(
        isValidOrigin(
          "https://(cdn|www).example.com",
          "https://ww.example.com"
        )
      ).toBe(false)
      expect(
        isValidOrigin(
          "https://(cdn|www).example.com",
          "https://cdn.123.example.com"
        )
      ).toBe(false)
      expect(
        isValidOrigin("https://(\\w+).com", "https://example.example.com")
      ).toBe(false)
    })

    it("handles patterns in the protocol part", () => {
      expect(
        isValidOrigin("https://example.com:*", "https://example.com")
      ).toBe(true)
      expect(
        isValidOrigin("https://example.com:*", "https://example.com:8080")
      ).toBe(true)
      expect(
        isValidOrigin("https://example.com:80*", "https://example.com:8080")
      ).toBe(true)
      expect(
        isValidOrigin("https://example.com:80*", "https://example.com:8091")
      ).toBe(true)
      expect(
        isValidOrigin("https://example.com:80*", "https://example.com:80")
      ).toBe(true)

      expect(
        isValidOrigin("https://example.com:*", "https://example.www.com:8080")
      ).toBe(false)
      expect(
        isValidOrigin("https://example.com:80*", "https://example.com:3000")
      ).toBe(false)
      expect(
        isValidOrigin("https://example.com:80*", "https://example.com:91")
      ).toBe(false)
    })
  })
})

describe("getPossibleBaseUris", () => {
  let originalPathName = ""

  beforeEach(() => {
    originalPathName = window.location.pathname
  })

  afterEach(() => {
    window.location.pathname = originalPathName
  })

  const testCases = [
    {
      description: "empty pathnames",
      pathname: "",
      expectedBasePaths: [""],
    },
    {
      description: "pathnames with a single part",
      pathname: "foo",
      expectedBasePaths: ["foo", ""],
    },
    {
      description: "pathnames with two parts",
      pathname: "foo/bar",
      expectedBasePaths: ["foo/bar", "foo"],
    },
    {
      description: "pathnames with more than two parts",
      pathname: "foo/bar/baz/qux",
      expectedBasePaths: ["foo/bar/baz/qux", "foo/bar/baz"],
    },
  ]

  testCases.forEach(({ description, pathname, expectedBasePaths }) => {
    it(`handles ${description}`, () => {
      window.location.pathname = pathname

      expect(getPossibleBaseUris().map(b => b.basePath)).toEqual(
        expectedBasePaths
      )
    })
  })
})
