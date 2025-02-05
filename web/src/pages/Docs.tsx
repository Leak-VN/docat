import React, { useEffect, useMemo, useState, useRef } from 'react'
import ProjectRepository from '../repositories/ProjectRepository'
import type ProjectDetails from '../models/ProjectDetails'
import LoadingPage from './LoadingPage'
import NotFound from './NotFound'
import DocumentControlButtons from '../components/DocumentControlButtons'
import IFrame from '../components/IFrame'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useMessageBanner } from '../data-providers/MessageBannerProvider'

export default function Docs (): JSX.Element {
  const params = useParams()
  const searchParams = useSearchParams()[0]
  const location = useLocation()
  const { showMessage, clearMessages } = useMessageBanner()

  const [versions, setVersions] = useState<ProjectDetails[]>([])
  const [loadingFailed, setLoadingFailed] = useState<boolean>(false)

  const project = useRef(params.project ?? '')
  const page = useRef(params.page ?? 'index.html')
  const hash = useRef(location.hash.split('?')[0] ?? '')

  const [version, setVersion] = useState<string>(params.version ?? 'latest')
  const [hideUi, setHideUi] = useState<boolean>(searchParams.get('hide-ui') === 'true' || location.hash.split('?')[1] === 'hide-ui=true')
  const [iframeUpdateTrigger, setIframeUpdateTrigger] = useState<number>(0)

  // This provides the url for the iframe.
  // It is always the same, except when the version changes,
  // as this memo will trigger a re-render of the iframe, which
  // is not needed when only the page or hash changes, because
  // the iframe keeps track of that itself.
  const iFrameSrc = useMemo(() => {
    return ProjectRepository.getProjectDocsURL(project.current, version, page.current, hash.current)
  }, [version, iframeUpdateTrigger])

  useEffect(() => {
    if (project.current === '') {
      return
    }

    void (async (): Promise<void> => {
      try {
        let allVersions = await ProjectRepository.getVersions(project.current)
        if (allVersions.length === 0) {
          setLoadingFailed(true)
          return
        }

        allVersions = allVersions.sort((a, b) => ProjectRepository.compareVersions(a, b))
        setVersions(allVersions)

        const latestVersion = ProjectRepository.getLatestVersion(allVersions).name
        if (version === 'latest') {
          if (latestVersion === 'latest') {
            return
          }
          setVersion(latestVersion)
          return
        }

        // custom version -> check if it exists
        // if it does. do nothing, as it should be set already
        const versionsAndTags = allVersions.map((v) => [v.name, ...v.tags]).flat()
        if (versionsAndTags.includes(version)) {
          return
        }

        // version does not exist -> fail
        setLoadingFailed(true)
        console.error(`Version '${version}' doesn't exist`)
      } catch (e) {
        console.error(e)
        setLoadingFailed(true)
      }
    })()
  }, [project])

  /** Encodes the url for the current page, and escapes the path part to avoid
   * redirecting to escapeSlashForDocsPath.
   * @example
   * getUrl('project', 'version', 'path/to/page.html', '#hash', false) -> '#/project/version/path%2Fto%2Fpage.html#hash'
   */
  const getUrl = (project: string, version: string, page: string, hash: string, hideUi: boolean): string => {
    return `#/${project}/${version}/${encodeURIComponent(page)}${hash}${hideUi ? '?hide-ui=true' : ''}`
  }

  const updateUrl = (newVersion: string, hideUi: boolean): void => {
    const url = getUrl(project.current, newVersion, page.current, hash.current, hideUi)
    window.history.pushState(null, '', url)
  }

  const iFramePageChanged = (urlPage: string, urlHash: string): void => {
    if (urlPage === page.current) {
      return
    }
    page.current = urlPage
    hash.current = urlHash
    updateUrl(version, hideUi)
  }

  const iFrameHashChanged = (newHash: string): void => {
    if (newHash === hash.current) {
      return
    }
    hash.current = newHash
    updateUrl(version, hideUi)
  }

  const onVersionChanged = (newVersion: string): void => {
    if (newVersion === version) {
      return
    }
    setVersion(newVersion)
    updateUrl(newVersion, hideUi)
  }

  const onHideUi = (): void => {
    setHideUi(true)
    updateUrl(version, true)
  }

  useEffect(() => {
    const urlProject = params.project ?? ''
    const urlVersion = params.version ?? 'latest'
    const urlPage = params.page ?? 'index.html'
    const urlHash = location.hash.split('?')[0] ?? ''
    const urlHideUi = searchParams.get('hide-ui') === 'true' || location.hash.split('?')[1] === 'hide-ui=true'

    // update the state to the url params on first loadon
    if (urlProject !== project.current) {
      setVersions([])
      project.current = urlProject
    }

    if (urlVersion !== version) {
      setVersion(urlVersion)
    }

    if (urlHideUi !== hideUi) {
      setHideUi(urlHideUi)
    }

    if (urlPage !== page.current) {
      page.current = urlPage
      setIframeUpdateTrigger(v => v + 1)
    }
    if (urlHash !== hash.current) {
      hash.current = urlHash
      setIframeUpdateTrigger(v => v + 1)
    }
  }, [location])

  useEffect(() => {
    // check every time the version changes whether the version
    // is the latest version and if not, show a banner
    if (versions.length === 0) {
      return
    }

    const latestVersion = ProjectRepository.getLatestVersion(versions).name
    if (version === latestVersion) {
      clearMessages()
      return
    }

    showMessage({
      content: 'You are viewing an outdated version of the documentation.',
      type: 'warning',
      showMs: null
    })
  }, [version, versions])

  if (loadingFailed || project.current === '') {
    return <NotFound />
  }

  if (versions.length === 0) {
    return <LoadingPage />
  }

  return (
    <>
      <IFrame
        src={iFrameSrc}
        onPageChanged={iFramePageChanged}
        onHashChanged={iFrameHashChanged}
      />
      {!hideUi && (
        <DocumentControlButtons
          version={version}
          versions={versions}
          onVersionChange={onVersionChanged}
          onHideUi={onHideUi}
        />)}
    </>
  )
}
