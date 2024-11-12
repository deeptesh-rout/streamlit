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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction


def test_material_symbol_from_latest_font_version_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that icon from latest version material symbol font renders correctly."""
    alert_elements = themed_app.get_by_test_id("stAlert")
    expect(alert_elements).to_have_count(1)

    markdown_elements = themed_app.get_by_test_id("stMarkdown")
    expect(markdown_elements).to_have_count(1)

    assert_snapshot(alert_elements.nth(0), name="st_alert-latest_material_symbol")
    assert_snapshot(markdown_elements.nth(0), name="st_markdown-latest_material_symbol")
