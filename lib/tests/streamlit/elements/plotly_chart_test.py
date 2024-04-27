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
from unittest.mock import MagicMock, patch

import plotly.express as px
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class PyDeckTest(DeltaGeneratorTestCase):
    def test_basic(self):
        """Test that plotly object works."""
        df = px.data.gapminder().query("country=='Canada'")
        fig = px.line(df, x="year", y="lifeExp", title="Life expectancy in Canada")
        st.plotly_chart(fig)

        el = self.get_delta_from_queue().new_element
        self.assertNotEqual(el.plotly_chart.spec, "")
        self.assertNotEqual(el.plotly_chart.config, "")

        # Check that deprecated properties are empty
        self.assertEqual(el.plotly_chart.figure.spec, "")
        self.assertEqual(el.plotly_chart.figure.config, "")
        self.assertEqual(el.plotly_chart.HasField("url"), False)

    @parameterized.expand(
        [
            ("streamlit", "streamlit"),
            (None, ""),
        ]
    )
    def test_theme(self, theme_value, proto_value):
        df = px.data.gapminder().query("country=='Canada'")
        fig = px.line(df, x="year", y="lifeExp", title="Life expectancy in Canada")
        st.plotly_chart(fig, theme=theme_value)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.plotly_chart.theme, proto_value)

    def test_bad_theme(self):
        df = px.data.gapminder().query("country=='Canada'")
        fig = px.line(df, x="year", y="lifeExp", title="Life expectancy in Canada")
        with self.assertRaises(StreamlitAPIException) as exc:
            st.plotly_chart(fig, theme="bad_theme")

        self.assertEqual(
            f'You set theme="bad_theme" while Streamlit charts only support theme=”streamlit” or theme=None to fallback to the default library theme.',
            str(exc.exception),
        )

    def test_st_plotly_chart_simple(self):
        """Test st.plotly_chart."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])

        data = [trace0]

        st.plotly_chart(data)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.plotly_chart.HasField("url"), False)
        self.assertNotEqual(el.plotly_chart.spec, "")
        self.assertNotEqual(el.plotly_chart.config, "")
        self.assertEqual(el.plotly_chart.use_container_width, False)

    def test_st_plotly_chart_use_container_width_true(self):
        """Test st.plotly_chart."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])

        data = [trace0]

        st.plotly_chart(data, use_container_width=True)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.plotly_chart.HasField("url"), False)
        self.assertNotEqual(el.plotly_chart.spec, "")
        self.assertNotEqual(el.plotly_chart.config, "")
        self.assertEqual(el.plotly_chart.use_container_width, True)

    def callback():
        pass

    @parameterized.expand(
        [
            ("rerun", [0, 1, 2]),
            ("ignore", []),
            (callback, [0, 1, 2]),
        ]
    )
    def test_st_plotly_chart_valid_on_select(self, on_select, proto_value):
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])

        data = [trace0]

        st.plotly_chart(data, on_select=on_select)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.plotly_chart.selection_mode, proto_value)
        self.assertEqual(el.plotly_chart.form_id, "")

    def test_plotly_chart_on_select_initial_returns(self):
        """Test st.plotly_chart returns an empty selection as initial result."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])

        data = [trace0]

        selection = st.plotly_chart(data, on_select="rerun", key="plotly_chart")

        self.assertEqual(selection.select.points, [])
        self.assertEqual(selection.select.box, [])
        self.assertEqual(selection.select.lasso, [])
        self.assertEqual(selection.select.point_indices, [])

        # Check that the selection state is added to the session state:
        self.assertEqual(st.session_state.plotly_chart.select.points, [])
        self.assertEqual(st.session_state.plotly_chart.select.box, [])
        self.assertEqual(st.session_state.plotly_chart.select.lasso, [])
        self.assertEqual(st.session_state.plotly_chart.select.point_indices, [])

    def test_st_plotly_chart_invalid_on_select(self):
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])

        data = [trace0]
        with self.assertRaises(StreamlitAPIException) as exc:
            st.plotly_chart(data, on_select="invalid")

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form_on_select_rerun(self):
        """Test that form id is marshalled correctly inside of a form."""
        import plotly.graph_objs as go

        with st.form("form"):
            trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])

            data = [trace0]
            st.plotly_chart(data, on_select="rerun")

        # 2 elements will be created: form block, plotly_chart
        self.assertEqual(len(self.get_all_deltas_from_queue()), 2)

        form_proto = self.get_delta_from_queue(0).add_block
        plotly_proto = self.get_delta_from_queue(1).new_element.plotly_chart
        self.assertEqual(plotly_proto.form_id, form_proto.form.form_id)

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form_on_select_ignore(self):
        """Test that form id is marshalled correctly inside of a form."""
        import plotly.graph_objs as go

        with st.form("form"):
            trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])

            data = [trace0]
            st.plotly_chart(data, on_select="ignore")

        # 2 elements will be created: form block, plotly_chart
        self.assertEqual(len(self.get_all_deltas_from_queue()), 2)

        form_proto = self.get_delta_from_queue(0).add_block
        plotly_proto = self.get_delta_from_queue(1).new_element.plotly_chart
        self.assertEqual(plotly_proto.form_id, form_proto.form.form_id)

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this is used with selections activated
        inside a cached function."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        data = [trace0]
        st.cache_data(lambda: st.plotly_chart(data, on_select="rerun"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        self.assertEqual(el.type, "CachedWidgetWarning")
        self.assertTrue(el.is_warning)

    def test_selection_mode_parsing(self):
        """Test that the selection_mode parameter is parsed correctly."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        data = [trace0]

        st.plotly_chart(data, on_select="rerun", selection_mode="points")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.plotly_chart.selection_mode, [0])

        st.plotly_chart(data, on_select="rerun", selection_mode=("points", "lasso"))
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.plotly_chart.selection_mode, [0, 2])

        st.plotly_chart(data, on_select="rerun", selection_mode={"box", "lasso"})
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.plotly_chart.selection_mode, [1, 2])
