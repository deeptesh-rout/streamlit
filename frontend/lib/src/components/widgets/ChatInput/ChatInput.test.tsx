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

import React from "react"

import { fireEvent, screen } from "@testing-library/react"

import { render } from "@streamlit/lib/src/test_util"
import {
  ChatInput as ChatInputProto,
  FileURLs as FileURLsProto,
  IChatInputValue,
} from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import { UploadFileInfo } from "@streamlit/lib/src/components/widgets/FileUploader/UploadFileInfo"

import ChatInput, { Props } from "./ChatInput"

const getProps = (
  elementProps: Partial<ChatInputProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: ChatInputProto.create({
    id: "123",
    placeholder: "Enter Text Here",
    disabled: false,
    default: "",
    acceptFile: "false",
    ...elementProps,
  }),
  width: 300,
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  // @ts-expect-error
  uploadClient: {
    uploadFile: jest.fn().mockImplementation(() => {
      return Promise.resolve()
    }),
    fetchFileURLs: jest.fn().mockImplementation((acceptedFiles: File[]) => {
      return Promise.resolve(
        acceptedFiles.map(file => {
          return new FileURLsProto({
            fileId: file.name,
            uploadUrl: file.name,
            deleteUrl: file.name,
          })
        })
      )
    }),
    deleteFile: jest.fn(),
  },
  ...widgetProps,
})

const mockChatInputValue = (
  text: string,
  _: UploadFileInfo[] = [] // TODO (sfc-gh-pchiu): implement mock for files
): IChatInputValue => {
  return {
    data: text,
    fileUploaderState: {
      uploadedFileInfo: [],
    },
  }
}

describe("ChatInput widget", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toBeInTheDocument()
  })

  it("shows a placeholder", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toHaveAttribute("placeholder", props.element.placeholder)
  })

  it("sets the aria label to the placeholder", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toHaveAttribute("aria-label", props.element.placeholder)
  })

  it("sets the value intially to the element default", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toHaveTextContent(props.element.default)
  })

  it("sets the value when values are typed in", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    fireEvent.change(chatInput, { target: { value: "Sample text" } })
    expect(chatInput).toHaveTextContent("Sample text")
  })

  it("does not increase text value when maxChars is set", () => {
    const props = getProps({ maxChars: 10 })
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    fireEvent.change(chatInput, { target: { value: "1234567890" } })
    expect(chatInput).toHaveTextContent("1234567890")
    fireEvent.change(chatInput, { target: { value: "12345678901" } })
    expect(chatInput).toHaveTextContent("1234567890")
  })

  it("sends and resets the value on enter", () => {
    const props = getProps()
    const spy = vi.spyOn(props.widgetMgr, "setStringTriggerValue")
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    fireEvent.change(chatInput, { target: { value: "1234567890" } })
    expect(chatInput).toHaveTextContent("1234567890")
    fireEvent.keyDown(chatInput, { key: "Enter" })
    expect(spy).toHaveBeenCalledWith(
      props.element,
      mockChatInputValue("1234567890"),
      {
        fromUi: true,
      },
      undefined
    )
    expect(chatInput).toHaveTextContent("")
  })

  it("ensures chat input has focus on submit by keyboard", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    fireEvent.change(chatInput, { target: { value: "1234567890" } })
    expect(chatInput).toHaveTextContent("1234567890")
    fireEvent.keyDown(chatInput, { key: "Enter" })
    expect(chatInput).toHaveFocus()
  })

  it("ensures chat input has focus on submit by button click", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    const chatButton = screen.getByTestId("stChatInputSubmitButton")
    fireEvent.change(chatInput, { target: { value: "1234567890" } })
    expect(chatInput).toHaveTextContent("1234567890")
    fireEvent.click(chatButton)
    expect(chatInput).toHaveFocus()
  })

  it("can set fragmentId when sending value", () => {
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    const spy = vi.spyOn(props.widgetMgr, "setStringTriggerValue")
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    fireEvent.change(chatInput, { target: { value: "1234567890" } })
    fireEvent.keyDown(chatInput, { key: "Enter" })
    expect(spy).toHaveBeenCalledWith(
      props.element,
      mockChatInputValue("1234567890"),
      {
        fromUi: true,
      },
      "myFragmentId"
    )
  })

  it("will not send an empty value on enter if empty", () => {
    const props = getProps()
    const spy = vi.spyOn(props.widgetMgr, "setStringTriggerValue")
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    fireEvent.keyDown(chatInput, { key: "Enter" })
    expect(spy).not.toHaveBeenCalledWith(props.element, "", {
      fromUi: true,
    })
    expect(chatInput).toHaveTextContent("")
  })

  it("will not show instructions when the text has changed", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    const instructions = screen.getByTestId("InputInstructions")
    expect(instructions).toHaveTextContent("")

    fireEvent.change(chatInput, { target: { value: "1234567890" } })
    expect(instructions).toHaveTextContent("")
  })

  it("does not send/clear on shift + enter", () => {
    const props = getProps()
    const spy = vi.spyOn(props.widgetMgr, "setStringTriggerValue")
    render(<ChatInput {...props} />)
    const chatInput = screen.getByTestId("stChatInputTextArea")

    fireEvent.change(chatInput, { target: { value: "1234567890" } })
    expect(chatInput).toHaveTextContent("1234567890")
    fireEvent.keyDown(chatInput, { key: "Enter", shiftKey: true })
    // We cannot test the value to be changed cause that is essentially a
    // change event.
    expect(chatInput).not.toHaveTextContent("")
    expect(spy).not.toHaveBeenCalled()
  })

  it("does not send/clear on ctrl + enter", () => {
    const props = getProps()
    const spy = vi.spyOn(props.widgetMgr, "setStringTriggerValue")
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    fireEvent.change(chatInput, { target: { value: "1234567890" } })
    expect(chatInput).toHaveTextContent("1234567890")
    fireEvent.keyDown(chatInput, { key: "Enter", ctrlKey: true })
    // We cannot test the value to be changed cause that is essentially a
    // change event.
    expect(chatInput).not.toHaveTextContent("")
    expect(spy).not.toHaveBeenCalled()
  })

  it("does not send/clear on meta + enter", () => {
    const props = getProps()
    const spy = vi.spyOn(props.widgetMgr, "setStringTriggerValue")
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    fireEvent.change(chatInput, { target: { value: "1234567890" } })
    expect(chatInput).toHaveTextContent("1234567890")
    fireEvent.keyDown(chatInput, { key: "Enter", metaKey: true })
    // We cannot test the value to be changed cause that is essentially a
    // change event.
    expect(chatInput).not.toHaveTextContent("")
    expect(spy).not.toHaveBeenCalled()
  })

  it("does sets the value if specified from protobuf to set it", () => {
    const props = getProps({ value: "12345", setValue: true })
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toHaveTextContent("12345")
  })

  it("does not set the value if protobuf does not specify to set it", () => {
    const props = getProps({ value: "12345", setValue: false })
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toHaveTextContent("")
  })

  it("disables the textarea and button", () => {
    const props = getProps({ disabled: true })
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).toBeDisabled()

    const button = screen.getByTestId("stChatInputSubmitButton")
    expect(button).toBeDisabled()
  })

  it("not disable the textarea by default", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    expect(chatInput).not.toBeDisabled()

    const button = screen.getByTestId("stChatInputSubmitButton")
    expect(button).toBeDisabled()
  })

  it("disables the send button by default since there's no text", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const button = screen.getByTestId("stChatInputSubmitButton")
    expect(button).toBeDisabled()
  })

  it("enables the send button when text is set, disables it when removed", () => {
    const props = getProps()
    render(<ChatInput {...props} />)

    const chatInput = screen.getByTestId("stChatInputTextArea")
    fireEvent.change(chatInput, { target: { value: "Sample text" } })

    const button = screen.getByTestId("stChatInputSubmitButton")
    expect(button).not.toBeDisabled()

    fireEvent.change(chatInput, { target: { value: "" } })
    expect(button).toBeDisabled()
  })
})
