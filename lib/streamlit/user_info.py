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

import urllib.parse
from typing import Iterator, Mapping, NoReturn, Union

from streamlit.errors import StreamlitAPIException
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.scriptrunner import get_script_run_ctx as _get_script_run_ctx
from streamlit.runtime.scriptrunner.script_run_context import UserInfo
from streamlit.runtime.secrets import secrets_singleton


def generate_login_redirect_url() -> str:
    _OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    if secrets_singleton.load_if_toml_exists():
        auth_section = secrets_singleton.get("auth")
        # TODO[kajarenc]: Add support for other OAuth providers
        redirect_uri = auth_section["redirect_uri"]
        client_id = auth_section["client_id"]
        scope = ["profile", "email"]

        args = {"response_type": "code", "approval_prompt": "auto"}
        if redirect_uri is not None:
            args["redirect_uri"] = redirect_uri

        if client_id is not None:
            args["client_id"] = client_id

        if scope:
            args["scope"] = " ".join(scope)

        query_string = urllib.parse.urlencode(args)
        url = _OAUTH_AUTHORIZE_URL

        return f"{url}?{query_string}"
    return ""


def _get_user_info() -> UserInfo:
    ctx = _get_script_run_ctx()
    if ctx is None:
        # TODO: Add appropriate warnings when ctx is missing
        return {}
    return ctx.user_info


# Class attributes are listed as "Parameters" in the docstring as a workaround
# for the docstring parser for docs.strreamlit.io
class UserInfoProxy(Mapping[str, Union[str, None]]):
    """
    A read-only, dict-like object for accessing information about current user.

    ``st.experimental_user`` is dependant on the host platform running the
    Streamlit app. If the host platform has not configured the function, it
    will behave as it does in a locally running app.

    Properties can by accessed via key or attribute notation. For example,
    ``st.experimental_user["email"]`` or ``st.experimental_user.email``.

    Parameters
    ----------
    email:str
        If running locally, this property returns the string literal
        ``"test@example.com"``.

        If running on Streamlit Community Cloud, this
        property returns one of two values:

        * ``None`` if the user is not logged in or not a member of the app's\
        workspace. Such users appear under anonymous pseudonyms in the app's\
        analytics.
        * The user's email if the the user is logged in and a member of the\
        app's workspace. Such users are identified by their email in the app's\
        analytics.

    """

    def login(self, send_redirect_to_host: bool = False) -> None:
        context = _get_script_run_ctx()
        if context is not None:

            fwd_msg = ForwardMsg()
            fwd_msg.auth_redirect.url = generate_login_redirect_url()
            fwd_msg.auth_redirect.action_type = "login"
            if send_redirect_to_host:
                fwd_msg.auth_redirect.send_redirect_to_host = True
            print("IN MIXIN!!!!")
            print(fwd_msg.auth_redirect)
            context.enqueue(fwd_msg)

    def __getitem__(self, key: str) -> str | None:
        return _get_user_info()[key]

    def __getattr__(self, key: str) -> str | None:
        try:
            return _get_user_info()[key]
        except KeyError:
            raise AttributeError

    def __setattr__(self, name: str, value: str | None) -> NoReturn:
        raise StreamlitAPIException("st.experimental_user cannot be modified")

    def __setitem__(self, name: str, value: str | None) -> NoReturn:
        raise StreamlitAPIException("st.experimental_user cannot be modified")

    def __iter__(self) -> Iterator[str]:
        return iter(_get_user_info())

    def __len__(self) -> int:
        return len(_get_user_info())

    def to_dict(self) -> UserInfo:
        """
        Get user info as a dictionary.

        This method primarily exists for internal use and is not needed for
        most cases. ``st.experimental_user`` returns an object that inherits from
        ``dict`` by default.

        Returns
        -------
        Dict[str,str]
            A dictionary of the current user's information.
        """
        return _get_user_info()
