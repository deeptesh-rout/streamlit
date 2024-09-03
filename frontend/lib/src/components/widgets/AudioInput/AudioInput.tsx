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

import React, { ReactElement, useState, useEffect } from "react"
import { Theme, withTheme } from "@emotion/react"
import WaveSurfer from "wavesurfer.js"
import BaseButton, {
  BaseButtonKind,
} from "@streamlit/lib/src/components/shared/BaseButton"
import { FileUploadClient } from "@streamlit/lib/src/FileUploadClient"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import { AudioInput as AudioInputProto } from "@streamlit/lib/src/proto"
import { uploadFiles } from "./uploadFiles"
import RecordPlugin from "wavesurfer.js/dist/plugins/record"
import Toolbar, {
  ToolbarAction,
} from "@streamlit/lib/src/components/shared/Toolbar"
import {
  StyledAudioInputContainerDiv,
  StyledWaveformContainerDiv,
  StyledWaveformInnerDiv,
  StyledWaveformTimeCode,
  StyledWaveSurferDiv,
} from "./styled-components"
import {
  Add,
  Close,
  Delete,
  FileDownload,
  Search,
  Mic,
} from "@emotion-icons/material-outlined"
import { PlayArrow, StopCircle, Pause } from "@emotion-icons/material-rounded"
import { EmotionTheme } from "@streamlit/lib/src/theme"

import Icon from "@streamlit/lib/src/components/shared/Icon"
import NoMicPermissions from "./NoMicPermissions"
import { WidgetLabel } from "../BaseWidget"
import { labelVisibilityProtoValueToEnum } from "@streamlit/lib/src/util/utils"
import Placeholder from "./Placeholder"

import {
  BAR_GAP,
  BAR_RADIUS,
  BAR_WIDTH,
  CURSOR_WIDTH,
  WAVEFORM_HEIGHT,
  WAVEFORM_PADDING,
} from "./constants"
import formatTime from "./formatTime"

interface Props {
  element: AudioInputProto
  uploadClient: FileUploadClient
  widgetMgr: WidgetStateManager
  theme: EmotionTheme
}

const AudioInput: React.FC<Props> = ({
  element,
  uploadClient,
  widgetMgr,
  theme,
}): ReactElement => {
  // WAVE SURFER SPECIFIC STUFF
  const [wavesurfer, setWavesurfer] = useState<WaveSurfer | null>(null)
  const waveSurferRef = React.useRef<HTMLDivElement | null>(null)
  const [deleteFileUrl, setDeleteFileUrl] = useState<string | null>(null)
  const [recordPlugin, setRecordPlugin] = useState<RecordPlugin | null>(null)
  const [availableAudioDevices, setAvailableAudioDevices] = useState<
    MediaDeviceInfo[]
  >([])
  const [activeAudioDeviceId, setActiveAudioDeviceId] = useState<
    string | null
  >(null)
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [, setRerender] = useState(0)
  const forceRerender = () => {
    setRerender(prev => prev + 1)
  }
  const [progressTime, setProgressTime] = useState("00:00")
  const [recordingTime, setRecordingTime] = useState("00:00")
  const [shouldUpdatePlaybackTime, setShouldUpdatePlaybackTime] =
    useState(false)
  const [hasNoMicPermissions, setHasNoMicPermissions] = useState(false)

  const uploadTheFile = (file: File) => {
    uploadFiles({
      files: [file],
      uploadClient,
      widgetMgr,
      widgetInfo: element,
    }).then(({ successfulUploads }) => {
      const upload = successfulUploads[0]
      if (upload && upload.fileUrl.deleteUrl) {
        setDeleteFileUrl(upload.fileUrl.deleteUrl)
      }
    })
  }

  useEffect(() => {
    // this first part is to ensure we prompt for getting the user's media devices
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(() => {
        RecordPlugin.getAvailableAudioDevices().then(devices => {
          setAvailableAudioDevices(devices)
          if (devices.length > 0) {
            setActiveAudioDeviceId(devices[0].deviceId)
          }
        })
      })
      .catch(_err => {
        setHasNoMicPermissions(true)
      })
  }, [])

  useEffect(() => {
    if (waveSurferRef.current === null) {
      return
    }

    if (wavesurfer) {
      wavesurfer.destroy()
    }

    const ws = WaveSurfer.create({
      container: waveSurferRef.current,
      waveColor: theme.colors.primary,
      progressColor: theme.colors.bodyText,
      height: WAVEFORM_HEIGHT - 2 * WAVEFORM_PADDING,
      barWidth: BAR_WIDTH,
      barGap: BAR_GAP,
      barRadius: BAR_RADIUS,
      cursorWidth: CURSOR_WIDTH,
    })

    ws.on("timeupdate", time => {
      updateProgress(time * 1000) // get from seconds to milliseconds
    })

    ws.on("pause", () => {
      forceRerender()
    })

    const recordPlugin = ws.registerPlugin(
      RecordPlugin.create({
        scrollingWaveform: false,
        renderRecordedAudio: true,
      })
    )

    recordPlugin.on("record-end", blob => {
      const url = URL.createObjectURL(blob)
      setRecordingUrl(url)

      const file = new File([blob], "audio.wav", { type: blob.type })
      uploadTheFile(file)

      ws.setOptions({
        waveColor: "#A5A5AA",
        progressColor: theme.colors.bodyText,
      })
    })

    recordPlugin.on("record-progress", time => {
      updateRecordingTime(time)
    })

    setWavesurfer(ws)
    setRecordPlugin(recordPlugin)

    const updateProgress = (time: number) => {
      const formattedTime = formatTime(time)

      setProgressTime(formattedTime)
    }

    const updateRecordingTime = (time: number) => {
      const formattedTime = formatTime(time)
      setRecordingTime(formattedTime)
    }

    return () => {
      if (wavesurfer) {
        wavesurfer.destroy()
      }
    }
  }, [theme])

  const onPlayPause = () => {
    wavesurfer && wavesurfer.playPause()

    // This is because we want the time to be the duration of the audio when they stop recording,
    // but once they start playing it, we want it to be the current time. So, once they start playing it
    // we'll start keeping track of the playback time from that point onwards (until re-recording).
    setShouldUpdatePlaybackTime(true)

    // to get the pause button to show
    forceRerender()
  }

  const handleRecord = () => {
    if (!recordPlugin || !activeAudioDeviceId || !wavesurfer) {
      return
    }

    if (recordPlugin.isRecording() || recordPlugin.isPaused()) {
      recordPlugin.stopRecording()
    } else {
      const deviceId = activeAudioDeviceId
      if (deviceId == null) {
        return
      }

      wavesurfer.setOptions({
        waveColor: theme.colors.primary,
      })

      recordPlugin
        .startRecording({ deviceId: activeAudioDeviceId })
        .then(() => {
          // Update the record button to show the user that they can stop recording
          forceRerender()
        })
    }
  }

  const handleClear = () => {
    if (wavesurfer == null || deleteFileUrl == null) {
      return
    }
    setRecordingUrl(null)
    wavesurfer.empty()
    uploadClient.deleteFile(deleteFileUrl)
    setProgressTime("00:00")
    setDeleteFileUrl(null)
    setShouldUpdatePlaybackTime(false)
    // TODO revoke the url so that it gets gced
  }

  const renderButton = () => {
    if (recordPlugin && recordPlugin.isRecording()) {
      // It's currently recording, so show the stop recording button
      return (
        <BaseButton
          kind={BaseButtonKind.BORDERLESS_ICON}
          onClick={handleRecord}
        >
          {recordPlugin && recordPlugin.isRecording()}
          <Icon
            content={StopCircle}
            size="lg"
            color={theme.colors.primary}
          ></Icon>
        </BaseButton>
      )
    } else if (recordingUrl) {
      if (wavesurfer && wavesurfer.isPlaying()) {
        // It's playing, so show the pause button
        return (
          <BaseButton
            kind={BaseButtonKind.BORDERLESS_ICON}
            onClick={onPlayPause}
          >
            <Icon
              content={Pause}
              size="lg"
              color={theme.colors.fadedText60}
            ></Icon>
          </BaseButton>
        )
      } else {
        // It's paused, so show the play button
        return (
          <BaseButton
            kind={BaseButtonKind.BORDERLESS_ICON}
            onClick={onPlayPause}
          >
            <Icon
              content={PlayArrow}
              size="lg"
              color={theme.colors.fadedText60}
            ></Icon>
          </BaseButton>
        )
      }
    } else {
      // Press the button to record
      return (
        <BaseButton
          kind={BaseButtonKind.BORDERLESS_ICON}
          onClick={handleRecord}
          disabled={hasNoMicPermissions}
        >
          <Icon
            content={Mic}
            size="lg"
            color={
              hasNoMicPermissions
                ? theme.colors.fadedText40
                : theme.colors.fadedText60
            }
          ></Icon>
        </BaseButton>
      )
    }
  }

  const showPlaceholder =
    !(recordPlugin && recordPlugin.isRecording()) &&
    !recordingUrl &&
    !hasNoMicPermissions

  const showNoMicPermissionsOrPlaceholder =
    hasNoMicPermissions || showPlaceholder

  const isPlayingOrRecording = Boolean(
    (recordPlugin && recordPlugin.isRecording()) ||
      (wavesurfer && wavesurfer.isPlaying())
  )

  return (
    <StyledAudioInputContainerDiv>
      <WidgetLabel
        label={element.label}
        disabled={hasNoMicPermissions}
        labelVisibility={labelVisibilityProtoValueToEnum(
          element.labelVisibility?.value
        )}
      ></WidgetLabel>
      <StyledWaveformContainerDiv data-testid="stAudioInput">
        <Toolbar
          isFullScreen={false}
          disableFullscreenMode={true}
          target={StyledWaveformContainerDiv}
        >
          {deleteFileUrl && (
            <ToolbarAction
              label="Clear recording"
              icon={Delete}
              onClick={handleClear}
            />
          )}
        </Toolbar>
        {renderButton()}
        <StyledWaveformInnerDiv>
          {showPlaceholder && <Placeholder />}
          {hasNoMicPermissions && <NoMicPermissions />}
          <StyledWaveSurferDiv
            ref={waveSurferRef}
            show={!showNoMicPermissionsOrPlaceholder}
          />
        </StyledWaveformInnerDiv>
        <StyledWaveformTimeCode isPlayingOrRecording={isPlayingOrRecording}>
          {shouldUpdatePlaybackTime ? progressTime : recordingTime}
        </StyledWaveformTimeCode>
      </StyledWaveformContainerDiv>
    </StyledAudioInputContainerDiv>
  )
}

export default withTheme(AudioInput)