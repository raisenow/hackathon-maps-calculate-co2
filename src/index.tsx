import './index.scss'
import React, {FC, Fragment, useEffect, useRef, useState, Suspense} from 'react'
import {render} from 'react-dom'
import zenscroll from 'zenscroll'
import {each} from 'lodash'
import {
  calculateAmount,
  calculateDistance,
  geolocate,
  initPlacesAutocomplete,
  useDeepCompare,
  loadScript,
  createCurve,
  useTamaro,
  createSubmitHandler,
  useTamaroRender,
} from './helpers'

///////////////////////////////////////////////////////////////////////////////

const GOOGLE_API_KEY = 'TODO'
const markerIcon = require('./assets/marker.svg')

///////////////////////////////////////////////////////////////////////////////

const App: FC = () => {
  const [origin, setOrigin] = useState(null)
  const [destination, setDestination] = useState(null)
  const [tripType, setTripType] = useState('roundtrip')
  const [distance, setDistance] = useState(0)
  const [amount, setAmount] = useState(0)

  useEffect(() => {
    setDistance(calculateDistance(origin, destination, tripType))
  }, useDeepCompare([origin, destination, tripType]))

  useEffect(() => {
    setAmount(calculateAmount(distance))
  }, [distance])

  const tamaroState = useTamaro({
    tamaro_url: 'https://tamaro.raisenow.com/..../latest/widget.js',
    language: 'de',
    debug: false,
  })
  const {tamaro, spinnerShown, isSubmitting, page} = tamaroState
  const submit = createSubmitHandler(tamaroState)

  window['api'] = tamaro

  useEffect(() => {
    if (tamaro) {
      tamaro.paymentForm.setAmount(amount)
    }
  }, [amount])

  useEffect(() => {
    if (isSubmitting) {
      submit()
    }
  }, [isSubmitting])

  if (spinnerShown) {
    return <Spinner/>
  }

  if (page === 'result-success') {
    return (
      <Suspense fallback={<Spinner/>}>
        <Header/>
        <TamaroWrapper tamaro={tamaro}/>
      </Suspense>
    )
  }

  if (page === 'result-error') {
    return (
      <Suspense fallback={<Spinner/>}>
        <Header/>
        <TamaroWrapper tamaro={tamaro}/>
      </Suspense>
    )
  }

  return (
    <Fragment>
      <Header/>
      <Map {...{origin, destination}}/>
      <Form {...{setOrigin, setDestination, tripType, setTripType, distance, amount}}/>
      {!!amount && <TamaroWrapper tamaro={tamaro}/>}
    </Fragment>
  )
}

///////////////////////////////////////////////////////////////////////////////

const Map: FC<any> = (props) => {
  const {origin, destination} = props
  const google = window['google']
  const ref = useRef<HTMLDivElement>()
  const mapRef = useRef(null)
  const originMarkerRef = useRef(null)
  const destinationMarkerRef = useRef(null)
  const curveRef = useRef(null)

  useEffect(() => {
    mapRef.current = new google.maps.Map(ref.current, {
      center: new google.maps.LatLng(46.204391, 6.143158),
      zoom: 5,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
    })
  }, [])

  useEffect(() => {
    if (origin) {
      const {lat, lng} = origin

      if (originMarkerRef.current) {
        originMarkerRef.current.setMap(null)
      }

      originMarkerRef.current = new google.maps.Marker({
        position: {lat, lng},
        icon: markerIcon,
        map: mapRef.current,
      })

      mapRef.current.setCenter(originMarkerRef.current.getPosition())
      mapRef.current.panBy(-250, 0)
    }
  }, useDeepCompare([origin]))

  useEffect(() => {
    if (destination) {
      const {lat, lng} = destination

      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setMap(null)
      }

      destinationMarkerRef.current = new google.maps.Marker({
        position: {lat, lng},
        icon: markerIcon,
        map: mapRef.current,
      })

      mapRef.current.setCenter(destinationMarkerRef.current.getPosition())
      mapRef.current.panBy(-250, 0)
    }
  }, useDeepCompare([destination]))

  useEffect(() => {
    if (curveRef.current) {
      curveRef.current.setMap(null)
    }

    curveRef.current = createCurve(mapRef.current, originMarkerRef.current, destinationMarkerRef.current)
  }, useDeepCompare([originMarkerRef.current, destinationMarkerRef.current]))

  useEffect(() => {
    const cb = () => {
      if (curveRef.current) {
        curveRef.current.setMap(null)
      }

      curveRef.current = createCurve(mapRef.current, originMarkerRef.current, destinationMarkerRef.current)
    }

    google.maps.event.addListener(mapRef.current, 'projection_changed', cb)
    google.maps.event.addListener(mapRef.current, 'zoom_changed', cb)
  }, [])

  useEffect(() => {
    if (!originMarkerRef.current || !destinationMarkerRef.current) {
      return
    }

    const bounds = new google.maps.LatLngBounds()

    each([originMarkerRef.current, destinationMarkerRef.current], marker => {
      if (marker && marker.getPosition()) {
        bounds.extend(marker.getPosition())
      }
    })

    mapRef.current.fitBounds(bounds, {left: 550})
  }, useDeepCompare([originMarkerRef.current, destinationMarkerRef.current]))

  return <div className="map" ref={ref}/>
}

///////////////////////////////////////////////////////////////////////////////

const Form: FC<any> = (props) => {
  const {setOrigin, setDestination, tripType, setTripType, distance, amount} = props
  const originRef = useRef<HTMLInputElement>()
  const destinationRef = useRef<HTMLInputElement>()
  const originPlacesAutocompleteRef = useRef()
  const destinationPlacesAutocompleteRef = useRef()

  useEffect(() => {
    originPlacesAutocompleteRef.current = initPlacesAutocomplete(originRef.current, (place) => {
      setOrigin({
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      })
    })
    originRef.current.addEventListener('focus', () => geolocate(originPlacesAutocompleteRef.current))

    destinationPlacesAutocompleteRef.current = initPlacesAutocomplete(destinationRef.current, (place) => {
      setDestination({
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      })
    })
    destinationRef.current.addEventListener('focus', () => geolocate(destinationPlacesAutocompleteRef.current))
  }, [])

  const scrollToTamaro = () => {
    const el = document.querySelector<HTMLElement>('.tamaro-wrapper-container')

    if (el) {
      zenscroll.toY(zenscroll.getTopOf(el), 1000)
    }
  }

  return (
    <div className="form-container">
      <div className="form-container__form">
        <div className="row-content">
          <strong>Buche dein KlimaTicket</strong>
          <p>Gib deine gewünschte Strecke ein</p>
        </div>

        <div className="row-input">
          <label>Von</label>
          <input type="text"
                 ref={originRef}
                 className="input"/>
        </div>

        <div className="row-input">
          <label>Nach</label>
          <input type="text"
                 ref={destinationRef}
                 className="input"/>
        </div>

        <div className="row-radios-group row-radios-group--inline">
          <label>
            <input type="radio"
                   name="tripType"
                   value="roundtrip"
                   checked={tripType === 'roundtrip'}
                   onChange={(e) => setTripType(e.target.value)}/>
              <span>Hin- und Rückflug</span>
          </label>
          <label>
            <input type="radio"
                   name="tripType"
                   value="oneway"
                   checked={tripType === 'oneway'}
                   onChange={(e) => setTripType(e.target.value)}/>
              <span>Hinflug</span>
          </label>
        </div>
      </div>


      {!!distance && !!amount && (
        <div className="form-container__calculations">
          <div className="row-calculations">
            <div className="distance">
              <div className="label">Distanz</div>
              <div className="value">{distance} km</div>
            </div>

            <div className="amount">
              <div className="label">Preis</div>
              <div className="value">CHF {amount}</div>
            </div>
          </div>

          <div className="row-button">
            <button onClick={scrollToTamaro}>Klimaticket Buchen</button>
          </div>
        </div>
      )}
    </div>
  )
}

///////////////////////////////////////////////////////////////////////////////

const TamaroWrapper: FC<any> = (props) => {
  const {tamaro} = props
  const rendered = useTamaroRender(tamaro, '.tamaro-wrapper-container__inner')

  return (
    <div className="tamaro-wrapper-container">
      <div className="tamaro-wrapper-container__inner"/>
      {!rendered && <Spinner/>}
    </div>
  )
}

///////////////////////////////////////////////////////////////////////////////

const Header: FC = () => (
  <div className="header">
    <div className="logo-cont"><div className="logo"/></div>
    <div className="navigation-cont"><div className="navigation"/></div>
  </div>
)

///////////////////////////////////////////////////////////////////////////////

const Spinner: FC = () => (
  <div className="spinner">
    <IconSpinner/>
  </div>
)

///////////////////////////////////////////////////////////////////////////////

const IconSpinner: FC = () => (
  <svg className="icon-spinner" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 100 100" focusable="false">
    <defs>
      <clipPath id="cut-off">
        <rect x="0" y="50" width="100" height="100"/>
      </clipPath>
      <linearGradient id="gradient">
        <stop className="icon-spinner__stop" offset="0" stopColor="#000"/>
        <stop className="icon-spinner__stop" offset="100%" stopColor="#000" stopOpacity="0"/>
      </linearGradient>
    </defs>
    <circle className="icon-spinner__circle" cx="50" cy="50" r="40" fill="none" strokeWidth="8"
            stroke="url(#gradient)"
            clipPath="url(#cut-off)"/>
  </svg>
)

///////////////////////////////////////////////////////////////////////////////

;(async () => {
  await loadScript(`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places,geometry&language=de`)

  render(<App/>, document.getElementById('root'))
})()


