# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import annotations

from pathlib import Path
from typing import Final

from playwright.sync_api import FrameLocator, Locator, Route, expect

from e2e_playwright.conftest import (
    IframedPage,
    IframedPageAttrs,
    ImageCompareFunction,
    wait_for_app_run,
    wait_until,
)
from e2e_playwright.shared.app_utils import (
    get_observed_connection_statuses,
    register_connection_status_observer,
)

TEST_ASSETS_DIR: Final[Path] = Path(__file__).parent / "test_assets"
HOSTFRAME_TEST_HTML: Final[str] = (TEST_ASSETS_DIR / "hostframe.html").read_text()


def _load_html_and_get_locators(
    iframed_app: IframedPage,
) -> tuple[FrameLocator, Locator]:
    page = iframed_app.page

    def fulfill_host_config_request(route: Route):
        response = route.fetch()
        result = response.json()
        result["allowedOrigins"] = ["http://localhost"]
        route.fulfill(json=result)

    page.route("**/_stcore/host-config", fulfill_host_config_request)

    frame_locator = iframed_app.open_app(
        IframedPageAttrs(html_content=HOSTFRAME_TEST_HTML)
    )

    # the toolbar and buttons are part of the HTML page, not the iframe
    toolbar = page.get_by_test_id("toolbar")
    expect(toolbar).to_have_count(1)
    toolbar_buttons = toolbar.get_by_role("button")
    expect(toolbar_buttons).to_have_count(13)
    wait_for_app_run(frame_locator)
    return frame_locator, toolbar_buttons


def test_handles_host_theme_message(
    iframed_app: IframedPage, assert_snapshot: ImageCompareFunction
):
    frame_locator, toolbar_buttons = _load_html_and_get_locators(iframed_app)
    assert_snapshot(
        frame_locator.get_by_test_id("stApp"), name="hostframe_app-theme_message_before"
    )
    toolbar_buttons.get_by_text("Send Theme").click()
    iframed_app.page.wait_for_timeout(5000)
    assert_snapshot(
        frame_locator.get_by_test_id("stApp"), name="hostframe_app-theme_message_after"
    )


def test_handles_set_file_upload_client_config_message(iframed_app: IframedPage):
    frame_locator, toolbar_buttons = _load_html_and_get_locators(iframed_app)

    file_name1 = "file1.txt"
    file_content1 = b"file1content"

    file_name2 = "file2.txt"
    file_content2 = b"file2content"

    files = [
        {"name": file_name1, "mimeType": "text/plain", "buffer": file_content1},
        {"name": file_name2, "mimeType": "text/plain", "buffer": file_content2},
    ]

    uploader_index = 0

    with iframed_app.page.expect_file_chooser() as fc_info:
        frame_locator.get_by_test_id("stFileUploaderDropzone").nth(
            uploader_index
        ).click()

    file_chooser = fc_info.value

    # First test without file upload config
    with iframed_app.page.expect_request(lambda request: request.method == "PUT") as r:
        file_chooser.set_files(files=files[0])

    url = r.value.url
    headers = r.value.all_headers()

    assert r.value.response().status == 204  # Upload successful
    assert url.startswith("http://localhost") and "_stcore/upload_file" in url
    assert "header1" not in headers

    wait_for_app_run(frame_locator, wait_delay=500)

    # Click the button to set the file upload config
    toolbar_buttons.get_by_text("Set file upload config").click()
    iframed_app.page.wait_for_timeout(5000)

    with iframed_app.page.expect_file_chooser() as fc_info:
        frame_locator.get_by_test_id("stFileUploaderDropzone").nth(
            uploader_index
        ).click()

    file_chooser = fc_info.value

    with iframed_app.page.expect_request(lambda request: request.method == "PUT") as r:
        file_chooser.set_files(files=files[1])

    url = r.value.url
    headers = r.value.all_headers()

    assert url.startswith("https://some-prefix.com/somethingelse/_stcore/upload_file/")
    assert "header1" in headers
    assert "header2" in headers

    assert headers["header1"] == "header1value"
    assert headers["header2"] == "header2value"


def test_handles_host_rerun_script_message(iframed_app: IframedPage):
    frame_locator, toolbar_buttons = _load_html_and_get_locators(iframed_app)
    toolbar_buttons.get_by_text("Rerun Script").click()
    expect(frame_locator.get_by_test_id("stApp")).to_have_attribute(
        "data-test-script-state", "running"
    )


def test_handles_host_stop_script_message(iframed_app: IframedPage):
    frame_locator, toolbar_buttons = _load_html_and_get_locators(iframed_app)
    # Make sure script is running
    toolbar_buttons.get_by_text("Rerun Script").click()
    # Check that status widget is running
    expect(frame_locator.get_by_test_id("stApp")).to_have_attribute(
        "data-test-script-state", "running"
    )
    toolbar_buttons.get_by_text("Stop Script").click()
    # Check that status widget is no longer running
    expect(frame_locator.get_by_test_id("stApp")).to_have_attribute(
        "data-test-script-state", "notRunning"
    )


def test_handles_host_close_modal_message(iframed_app: IframedPage):
    frame_locator, toolbar_buttons = _load_html_and_get_locators(iframed_app)

    # Open the Main Menu
    frame_locator.get_by_test_id("stMainMenu").locator("button").click()
    # Open the Settings Modal
    frame_locator.get_by_test_id("stMainMenuList").get_by_text("Settings").click()

    expect(frame_locator.get_by_role("dialog")).to_be_attached()
    # Close the Modal
    toolbar_buttons.get_by_text("Close Modal").click()
    expect(frame_locator.get_by_role("dialog")).not_to_be_attached()


def test_handles_host_menu_item_message(iframed_app: IframedPage):
    frame_locator, toolbar_buttons = _load_html_and_get_locators(iframed_app)
    toolbar_buttons.get_by_text("Add Menu Item").click()
    # Open the Main Menu
    frame_locator.get_by_test_id("stMainMenu").locator("button").click()
    menu_list = frame_locator.get_by_test_id("stMainMenuList")
    expect(menu_list.get_by_text("Adopt a Corgi")).to_be_attached()


def test_handles_host_toolbar_item_message(
    iframed_app: IframedPage, assert_snapshot: ImageCompareFunction
):
    frame_locator, toolbar_buttons = _load_html_and_get_locators(iframed_app)
    toolbar_buttons.get_by_text("Add Toolbar Item").click()

    toolbar_action_button = frame_locator.get_by_test_id("stToolbarActionButton")
    expect(toolbar_action_button).to_have_count(2)
    expect(toolbar_action_button.nth(0)).to_have_text("Favorite")
    expect(toolbar_action_button.nth(1)).to_have_text("Share")

    assert_snapshot(
        frame_locator.get_by_test_id("stApp"), name="hostframe_app-toolbar_items"
    )


def test_handles_hide_sidebar_nav_message(iframed_app: IframedPage):
    frame_locator, toolbar_buttons = _load_html_and_get_locators(iframed_app)
    expect(frame_locator.get_by_test_id("stSidebarNav")).to_be_attached()
    toolbar_buttons.get_by_text("Hide Sidebar Nav").click()
    expect(frame_locator.get_by_test_id("stSidebarNav")).not_to_be_attached()


def test_handles_sidebar_downshift_message(iframed_app: IframedPage):
    frame_locator, toolbar_buttons = _load_html_and_get_locators(iframed_app)
    # Trigger sidebar downshift
    toolbar_buttons.get_by_text("Sidebar Chevron Downshift").click()
    # Hover over sidebar to reveal the button
    frame_locator.get_by_test_id("stSidebarContent").hover()
    # Close the sidebar
    frame_locator.get_by_test_id("stSidebar").locator("button").click()
    # Check chevron positioning
    expect(frame_locator.get_by_test_id("stSidebarCollapsedControl")).to_have_css(
        "top", "50px"
    )


def test_handles_host_terminate_and_restart_websocket_connection_messages(
    iframed_app: IframedPage,
):
    frame_locator, toolbar_buttons = _load_html_and_get_locators(iframed_app)

    # Kill the websocket connection and verify that the app moves into an
    # error state.
    toolbar_buttons.get_by_text("Terminate Websocket").click()
    expect(frame_locator.get_by_test_id("stApp")).to_have_attribute(
        "data-test-connection-state", "DISCONNECTED_FOREVER"
    )
    frame = frame_locator.owner.page.frame("guest")
    assert frame is not None
    # start observing our connection statuses before we click on restart websocket
    register_connection_status_observer(frame)

    # Request that the websocket connection gets restarted.
    toolbar_buttons.get_by_text("Restart Websocket").click()
    wait_until(
        iframed_app.page,
        lambda: len(get_observed_connection_statuses(frame)) == 3,
        timeout=5000,
    )
    statuses = get_observed_connection_statuses(frame)
    assert statuses[0] == "PINGING_SERVER"
    assert statuses[1] == "CONNECTING"
    assert statuses[2] == "CONNECTED"

    # Check that the script state of the app indicates not running.
    expect(frame_locator.get_by_test_id("stApp")).to_have_attribute(
        "data-test-script-state", "notRunning"
    )
