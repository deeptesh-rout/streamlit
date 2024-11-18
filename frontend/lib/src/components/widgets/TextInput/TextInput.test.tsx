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

import { act, fireEvent, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { render } from "@streamlit/lib/src/test_util"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import {
  LabelVisibilityMessage as LabelVisibilityMessageProto,
  TextInput as TextInputProto,
} from "@streamlit/lib/src/proto"

import TextInput, { Props } from "./TextInput"

const getProps = (
  elementProps: Partial<TextInputProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: TextInputProto.create({
    label: "Label",
    default: "",
    placeholder: "Placeholder",
    type: TextInputProto.Type.DEFAULT,
    ...elementProps,
  }),
  width: 300,
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  ...widgetProps,
})

describe("TextInput widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    expect(textInput).toBeInTheDocument()
  })

  it("shows a label", () => {
    const props = getProps()
    render(<TextInput {...props} />)

    const widgetLabel = screen.getByText(`${props.element.label}`)
    expect(widgetLabel).toBeInTheDocument()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })

    render(<TextInput {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle(
      "visibility: hidden"
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<TextInput {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle("display: none")
  })

  it("shows a placeholder", () => {
    const props = getProps()
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    expect(textInput).toHaveAttribute("placeholder", props.element.placeholder)
  })

  it("handles default text input type properly", () => {
    const defaultProps = getProps({ type: TextInputProto.Type.DEFAULT })
    render(<TextInput {...defaultProps} />)
    const textInput = screen.getByRole("textbox")
    expect(textInput).toHaveAttribute("type", "text")
    // Check that no show/hide button renders
    const textInputContainer = screen.getByTestId("stTextInputRootElement")
    const showButton = within(textInputContainer).queryByRole("button")
    expect(showButton).not.toBeInTheDocument()
  })

  it("handles password text input type properly", () => {
    const passwordProps = getProps({ type: TextInputProto.Type.PASSWORD })
    render(<TextInput {...passwordProps} />)
    const passwordTextInput = screen.getByPlaceholderText("Placeholder")
    expect(passwordTextInput).toHaveAttribute("type", "password")
    // Check for the show/hide button
    const textInputContainer = screen.getByTestId("stTextInputRootElement")
    const showButton = within(textInputContainer).getByRole("button")
    expect(showButton).toBeInTheDocument()
  })

  it("handles TextInputProto.autocomplete", () => {
    let props = getProps()
    const { unmount } = render(<TextInput {...props} />)
    const textInput = screen.getByRole("textbox")
    expect(textInput).toHaveAttribute("autoComplete", "")
    // unmount the initial component
    unmount()

    props = getProps({ autocomplete: "one-time-password" })
    render(<TextInput {...props} />)
    const autocompleteTextInput = screen.getByRole("textbox")
    expect(autocompleteTextInput).toHaveAttribute(
      "autoComplete",
      "one-time-password"
    )
  })

  it("sets widget value on mount", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false },
      undefined
    )
  })

  it("can pass fragmentId to setStringValue", () => {
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      props.element.default,
      { fromUi: false },
      "myFragmentId"
    )
  })

  it("has correct className and style", () => {
    const props = getProps()
    render(<TextInput {...props} />)
    const textInput = screen.getByTestId("stTextInput")

    expect(textInput).toHaveClass("stTextInput")
    expect(textInput).toHaveStyle(`width: ${props.width}px`)
  })

  it("can be disabled", () => {
    const props = getProps({}, { disabled: true })
    render(<TextInput {...props} />)
    const textInput = screen.getByRole("textbox")
    expect(textInput).toBeDisabled()
  })

  it("sets widget value on blur", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    fireEvent.change(textInput, { target: { value: "testing" } })
    fireEvent.blur(textInput)

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledWith(
      props.element,
      "testing",
      {
        fromUi: true,
      },
      undefined
    )
  })

  it("sets widget value when enter is pressed", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)
    const textInput = screen.getByRole("textbox")

    // userEvent necessary to trigger onKeyPress
    // fireEvent only dispatches DOM events vs. simulating full interactions
    await user.click(textInput)
    await user.keyboard("testing{Enter}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "testing",
      {
        fromUi: true,
      },
      undefined
    )
  })

  it("does not sync widget value when value did not change", async () => {
    const user = userEvent.setup()
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)
    const textInput = screen.getByRole("textbox")

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(1)

    // userEvent necessary to trigger onKeyPress
    // fireEvent only dispatches DOM events vs. simulating full interactions
    await user.click(textInput)
    await user.keyboard("testing{Enter}")

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "testing",
      {
        fromUi: true,
      },
      undefined
    )
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(2)

    // losing focus after value changed triggers a server sync
    await user.click(textInput)
    await user.keyboard("moreTesting")
    // click somewhere to lose focus on the input
    await user.click(document.body)

    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      "testingmoreTesting",
      {
        fromUi: true,
      },
      undefined
    )
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(3)

    // focusing and clicking enter again without changing the value does
    // not trigger a server-sync and, thus, no re-run
    await user.click(textInput)
    await user.keyboard("{enter}")
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(3)

    // focusing and losing focus without changing the value does
    // not trigger a server-sync and, thus, no re-run
    await user.click(textInput)
    await user.click(document.body)
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(3)
  })

  it("doesn't set widget value when not dirty", () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    fireEvent.keyPress(textInput, { key: "Enter" })

    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(1)

    fireEvent.blur(textInput)
    expect(props.widgetMgr.setStringValue).toHaveBeenCalledTimes(1)
  })

  it("limits input length if max_chars is passed", () => {
    const props = getProps({ maxChars: 10 })
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    fireEvent.change(textInput, { target: { value: "0123456789" } })
    expect(textInput).toHaveValue("0123456789")

    fireEvent.change(textInput, { target: { value: "0123456789a" } })
    expect(textInput).toHaveValue("0123456789")
  })

  it("does update widget value on text changes when inside of a form", async () => {
    const props = getProps({ formId: "formId" })
    const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")
    vi.spyOn(props.widgetMgr, "allowFormEnterToSubmit").mockReturnValue(true)

    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    fireEvent.change(textInput, { target: { value: "TEST" } })
    expect(textInput).toHaveValue("TEST")

    fireEvent.focus(textInput)
    expect(
      await screen.findByText("Press Enter to submit form")
    ).toBeInTheDocument()

    expect(setStringValueSpy).toHaveBeenCalledWith(
      props.element,
      "TEST",
      {
        fromUi: true,
      },
      undefined
    )
  })

  it("does not update widget value on text changes when outside of a form", async () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setStringValue")
    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    fireEvent.change(textInput, { target: { value: "TEST" } })
    expect(textInput).toHaveValue("TEST")

    fireEvent.focus(textInput)
    expect(await screen.findByText("Press Enter to apply")).toBeInTheDocument()

    // Check that the last call was in componentDidMount.
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: false,
      },
      undefined
    )
  })

  it("resets its value when form is cleared", () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormSubmitBehaviors("form", true)

    vi.spyOn(props.widgetMgr, "setStringValue")

    render(<TextInput {...props} />)
    const textInput = screen.getByRole("textbox")
    // Change the widget value
    fireEvent.change(textInput, { target: { value: "TEST" } })

    act(() => {
      // "Submit" the form
      props.widgetMgr.submitForm("form", undefined)
    })

    // Our widget should be reset, and the widgetMgr should be updated
    expect(textInput).toHaveValue(props.element.default)
    expect(props.widgetMgr.setStringValue).toHaveBeenLastCalledWith(
      props.element,
      props.element.default,
      {
        fromUi: true,
      },
      undefined
    )
  })

  it("shows Input Instructions on dirty state by default", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<TextInput {...props} />)

    // Trigger dirty state
    const textInput = screen.getByRole("textbox")
    await user.click(textInput)
    await user.keyboard("TEST")

    expect(screen.getByText("Press Enter to apply")).toBeVisible()
  })

  it("shows Input Instructions if in form that allows submit on enter", async () => {
    const user = userEvent.setup()
    const props = getProps({ formId: "form" })
    vi.spyOn(props.widgetMgr, "allowFormEnterToSubmit").mockReturnValue(true)

    render(<TextInput {...props} />)

    // Trigger dirty state
    const textInput = screen.getByRole("textbox")
    await user.click(textInput)
    await user.keyboard("TEST")

    expect(screen.getByText("Press Enter to submit form")).toBeVisible()
  })

  // For this scenario https://github.com/streamlit/streamlit/issues/7079
  it("shows Input Instructions if focused again in form that allows submit on enter", async () => {
    const user = userEvent.setup()
    const props = getProps({ formId: "form" })
    vi.spyOn(props.widgetMgr, "allowFormEnterToSubmit").mockReturnValue(true)

    render(<TextInput {...props} />)

    const textInput = screen.getByRole("textbox")
    await user.click(textInput)
    await user.keyboard("TEST")

    // Remove focus
    fireEvent.blur(textInput)
    expect(screen.queryByTestId("InputInstructions")).not.toBeInTheDocument()

    // Then focus again
    fireEvent.focus(textInput)
    expect(screen.getByText("Press Enter to submit form")).toBeVisible()
  })

  it("hides Input Instructions if in form that doesn't allow submit on enter", async () => {
    const user = userEvent.setup()
    const props = getProps({ formId: "form" })
    vi.spyOn(props.widgetMgr, "allowFormEnterToSubmit").mockReturnValue(false)

    render(<TextInput {...props} />)

    // Trigger dirty state
    const textInput = screen.getByRole("textbox")
    await user.click(textInput)
    await user.keyboard("TEST")

    expect(screen.queryByTestId("InputInstructions")).toHaveTextContent("")
  })

  it("hides Please enter to apply text when width is smaller than 180px", () => {
    const props = getProps({}, { width: 100 })
    render(<TextInput {...props} />)

    // Focus on input
    const textInput = screen.getByRole("textbox")
    fireEvent.focus(textInput)

    expect(screen.queryByTestId("InputInstructions")).not.toBeInTheDocument()
  })

  it("shows Please enter to apply text when width is bigger than 180px", () => {
    const props = getProps({}, { width: 190 })
    render(<TextInput {...props} />)

    // Focus on input
    const textInput = screen.getByRole("textbox")
    fireEvent.focus(textInput)

    expect(screen.getByTestId("InputInstructions")).toBeInTheDocument()
  })

  it("focuses input when clicking label", async () => {
    const props = getProps()
    render(<TextInput {...props} />)
    const textInput = screen.getByRole("textbox")
    expect(textInput).not.toHaveFocus()
    const label = screen.getByText(props.element.label)
    const user = userEvent.setup()
    await user.click(label)
    expect(textInput).toHaveFocus()
  })

  it("ensures id doesn't change on rerender", () => {
    const props = getProps()
    render(<TextInput {...props} />)

    const textInputLabel1 = screen.getByTestId("stWidgetLabel")
    const forId1 = textInputLabel1.getAttribute("for")

    // Make some change to cause a rerender
    const textInput = screen.getByRole("textbox")
    fireEvent.change(textInput, { target: { value: "0123456789" } })
    expect(textInput).toHaveValue("0123456789")

    const textInputLabel2 = screen.getByTestId("stWidgetLabel")
    const forId2 = textInputLabel2.getAttribute("for")

    expect(forId2).toBe(forId1)
  })
})
