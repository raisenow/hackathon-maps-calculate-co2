import {useEffect, useRef, useState} from 'react'
import {isEqual, each, isFunction} from 'lodash'

///////////////////////////////////////////////////////////////////////////////

type PlaceResult = {
  geometry: any
}

type LatLng = {
  lat: number
  lng: number
}

///////////////////////////////////////////////////////////////////////////////

export type TamaroInstance = any

export type UseTamaroOptions = {
  tamaro_url: string
  language: string
  debug: boolean
}

export type TamaroState = ReturnType<typeof useTamaro>

///////////////////////////////////////////////////////////////////////////////


export function useDeepCompare(value) {
  const ref = useRef()

  if (!isEqual(value, ref.current)) {
    ref.current = value
  }

  return ref.current
}

///////////////////////////////////////////////////////////////////////////////

export const loadScript = async (url) => {
  let script = document.createElement('script')
  script.src = url
  script.async = true
  document.head.appendChild(script)

  return new Promise((resolve) => {
    script.onload = () => {
      console.log(`script loaded: ${url}`)
      resolve()
    }
  })
}

///////////////////////////////////////////////////////////////////////////////

export const initPlacesAutocomplete = (el, placeSelectedCallback) => {
  const placesAutocomplete = new window['google'].maps.places.Autocomplete(el, {
    types: ['geocode', 'establishment'],
    fields: ['geometry'],
  })

  const placeSelected = () => {
    const place = placesAutocomplete.getPlace() as PlaceResult

    if (!place.geometry) {
      console.log('Returned place contains no geometry')

      return
    }

    console.log('--> placeSelected', place)
    placeSelectedCallback(place)
  }

  placesAutocomplete.addListener('place_changed', placeSelected)

  return placesAutocomplete
}

///////////////////////////////////////////////////////////////////////////////

export const geolocate = (placesAutocomplete) =>  {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      const geolocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }
      const circle = new window['google'].maps.Circle({
        center: geolocation,
        radius: position.coords.accuracy,
      })

      placesAutocomplete.setBounds(circle.getBounds())
    })
  }
}

///////////////////////////////////////////////////////////////////////////////

export const calculateDistance = (origin: LatLng, destination: LatLng, tripType: string): number => {
  console.log('--> calculateDistance', origin, destination, tripType)

  if (!origin || !destination || !tripType) {
    return 0
  }

  const originLatLng = origin.lat && origin.lng ? new window['google'].maps.LatLng(origin.lat, origin.lng) : null
  const destinationLatLng = destination.lat && destination.lng ? new window['google'].maps.LatLng(destination.lat, destination.lng) : null

  if (originLatLng && destinationLatLng) {
    let distance = parseInt(window['google'].maps.geometry.spherical.computeDistanceBetween(originLatLng, destinationLatLng), 10)

    if (tripType === 'roundtrip') {
      distance *= 2
    }

    distance = Math.floor(distance / 1000)

    return distance
  } else {
    console.log(`--> can't calculate distance`)
    return 0
  }
}

///////////////////////////////////////////////////////////////////////////////

export const calculateAmount = (distance: number): number => {
  console.log('--> calculateAmount', distance)

  if (!distance) {
    return 0
  }

  return parseInt((distance * 0.02).toFixed(2))
}

///////////////////////////////////////////////////////////////////////////////

export const createCurve = (map, originMarker, destinationMarker) => {
  if (!map || !originMarker || !destinationMarker) {
    return null
  }

  const google = window['google']
  const pos1 = originMarker.getPosition()
  const pos2 = destinationMarker.getPosition()
  const projection = map.getProjection()
  const p1 = projection.fromLatLngToPoint(pos1)
  const p2 = projection.fromLatLngToPoint(pos2)

  const e = new google.maps.Point(p2.x - p1.x, p2.y - p1.y),
    m = new google.maps.Point(e.x / 2, e.y / 2),
    o = new google.maps.Point(e.y, -e.x),
    c = new google.maps.Point(m.x + 0.2 * o.x, m.y + 0.2 * o.y)

  const pathDef = 'M 0,0 ' + 'q ' + c.x + ',' + c.y + ' ' + e.x + ',' + e.y

  const zoom = map.getZoom()
  const scale = 1 / (Math.pow(2, -zoom))

  const symbol = {
    path: pathDef,
    scale: scale,
    strokeWeight: 2,
    strokeColor: '#000000',
    strokeOpacity: 0.9,
    fillColor: 'none'
  }

  return new google.maps.Marker({
    position: pos1,
    clickable: false,
    icon: symbol,
    zIndex: 1,
    map
  })
}

///////////////////////////////////////////////////////////////////////////////

export const getTamaroPreloader = () => window['rnw'] && window['rnw']['tamaro']

///////////////////////////////////////////////////////////////////////////////

export const useTamaro = (options: UseTamaroOptions) => {
  const {tamaro_url, language, debug} = options
  const tamaro = useRef(null)
  const [initialized, setInitialized] = useState<boolean>(false)
  const [spinnerShown, setSpinnerShown] = useState<boolean>(true)
  const [fetchingPaymentData, setFetchingPaymentData] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [page, setPage] = useState('form')
  const subscribtions = []

  useEffect(() => {
    const init = async () => {
      console.log('--> init tamaro')

      if (!getTamaroPreloader()) {
        setSpinnerShown(true)
        await loadScript(tamaro_url)
      }

      const tamaroPreloader = getTamaroPreloader()

      subscribtions.push(tamaroPreloader.events.afterCreate['subscribe'](async (event) => {
        let tamaro = event.data.api

        // prevent tamaro's handling of form submission
        // this allows us to handle it ourselves
        // see below – beforePaymentValidateAndSend event handler
        tamaro.flags.add('prevent_payment_validate_and_send')
      }))

      subscribtions.push(tamaroPreloader.events.fetchPaymentDataStart['subscribe'](async () => {
        setFetchingPaymentData(true)
        setSpinnerShown(true)
      }))

      subscribtions.push(tamaroPreloader.events.fetchPaymentDataEnd['subscribe'](async (event) => {
        setTimeout(async () => {
          const tamaro = event.data.api
          const {transactionInfo} = tamaro

          if (transactionInfo) {
            if (transactionInfo.epayment_status === 'success') {
              setPage('result-success')
            } else {
              setPage('result-error')
            }

          } else if (tamaro.flags.has('transaction_not_found')) {
            setPage('result-error')
          } else {
            setPage('form')
          }

          // console.log('scrollToTop({timeout: 100})')
          // // todo: scroll to top

          setFetchingPaymentData(false)
          setSpinnerShown(false)
        })
      }))

      subscribtions.push(tamaroPreloader.events.beforePaymentValidateAndSend['subscribe'](async (event) => {
        setIsSubmitting(true)
      }))

      if (debug) {
        subscribtions.push(tamaroPreloader.events.paymentValidateError['subscribe']((event) => {
          let tamaro = event.data.api

          console.log(
            '--> tamaro.paymentForm.validationErrors',
            tamaroPreloader.toJS(tamaro.paymentForm.validationErrors)
          )
        }))
      }

      await tamaroPreloader.loadWidget()

      tamaro.current = await tamaroPreloader.createWidget({
        language,
        debug,
        showTestModeBar: false,
      })
      setInitialized(true)
    }

    init()

    return () => {
      each(subscribtions, v => {
        if (isFunction(v)) {
          v()
        }
      })
    }
  }, [])

  useEffect(() => {
    if (initialized && spinnerShown && !fetchingPaymentData) {
      setSpinnerShown(false)
    }
  }, [initialized, spinnerShown, fetchingPaymentData])

  useEffect(() => {
    if (tamaro && tamaro.current) {
      tamaro.current.config.language = language
    }
  }, useDeepCompare([tamaro, language]))

  return {
    tamaro: tamaro.current,
    spinnerShown,
    setSpinnerShown,
    fetchingPaymentData,
    setFetchingPaymentData,
    isSubmitting,
    setIsSubmitting,
    page,
    setPage,
  }
}

///////////////////////////////////////////////////////////////////////////////

export const createSubmitHandler = (tamaroState: TamaroState) => {
  const {tamaro, setPage, setIsSubmitting} = tamaroState

  return async () => {
    try {
      let tamaroErrors = await tamaro.paymentForm.validate(false)

      if (tamaroErrors) {
        return tamaroErrors
      }

      await tamaro.paymentForm.send()

      // setPage('result-success')
      // scrollToTop({timeout: 100})

    } catch (error) {

      console.log('--> error', error)
      // scrollToTop({timeout: 100})
      setPage('result-error')

    } finally {

      setIsSubmitting(false)
    }
  }
}

///////////////////////////////////////////////////////////////////////////////

export const useTamaroRender = (tamaro, target) => {
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    const renderTamaro = async () => {
      // await delay(2000)
      await getTamaroPreloader().renderWidget(tamaro, target)

      setTimeout(() => {
        setRendered(true)
      }, 0)
    }

    renderTamaro()
  }, [])

  return rendered
}
