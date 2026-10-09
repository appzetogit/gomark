import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UtensilsCrossed, ShoppingBasket, Car, Wrench, Pill, ArrowRight, Star, Clock,
  MapPin, ShieldCheck, Wallet, Headphones, Zap, Menu, X, ChevronDown, Store,
  Bike, Users, Smartphone, CheckCircle2, Sparkles,
} from 'lucide-react'
import logo from './assets/k9-logo.png'

/*
 * GoMark landing page.
 * Palette comes straight from the logo: lime -> yellow -> amber gradient on the
 * "GO" mark, an orange runner, and black/yellow "MARK" tiles.
 */
const C = {
  lime: '#8CC63F',
  yellow: '#F5C400',
  amber: '#FFA41B',
  ink: '#111111',
}
const GRAD = 'linear-gradient(90deg, #8CC63F 0%, #D4D11E 45%, #F5C400 70%, #FFA41B 100%)'

const img = (id, w = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`

const SERVICES = [
  {
    key: 'food', title: 'Food Delivery', icon: UtensilsCrossed, to: '/food/user',
    blurb: 'Biryani, thalis, pizzas and late-night cravings from the best kitchens in town.',
    tag: '30 min avg', image: img('photo-1504674900247-0877df9cc836'),
  },
  {
    key: 'grocery', title: 'Grocery in Minutes', icon: ShoppingBasket, to: '/food/user',
    blurb: 'Fresh fruits, dairy, staples and daily essentials from neighbourhood stores.',
    tag: 'Fresh daily', image: img('photo-1542838132-92c53300491e'),
  },
  {
    key: 'rides', title: 'Rides', icon: Car, to: '/taxi/user',
    blurb: 'Bike, auto, mini, sedan or SUV. Upfront fares, verified drivers, live tracking.',
    tag: '5 ride types', image: img('photo-1449965408869-eaa3f722e40d'),
  },
  {
    key: 'services', title: 'Home Services', icon: Wrench, to: '/food/user',
    blurb: 'AC repair, electricians, plumbers, cleaning and salon at home by trained pros.',
    tag: '60+ services', image: img('photo-1581578731548-c64695cc6952'),
  },
  {
    key: 'pharmacy', title: 'Pharmacy', icon: Pill, to: '/food/user',
    blurb: 'Medicines and wellness essentials from licensed chemists near you.',
    tag: 'Licensed stores', image: img('photo-1587854692152-cbe660dbde88'),
  },
]

const RESTAURANTS = [
  { name: 'Old City Biryani House', cuisine: 'Biryani · Mughlai', rating: 4.6, eta: '28 min', price: '₹350 for two', image: img('photo-1563379091339-03b21ab4a4f8', 700) },
  { name: 'Lakeview Pizza Co.', cuisine: 'Pizza · Italian', rating: 4.4, eta: '32 min', price: '₹450 for two', image: img('photo-1513104890138-7c749659a591', 700) },
  { name: 'Shree Sagar Veg', cuisine: 'South Indian · Thali', rating: 4.5, eta: '25 min', price: '₹250 for two', image: img('photo-1630383249896-424e482df921', 700) },
  { name: 'Burger Junction', cuisine: 'Burgers · Fast Food', rating: 4.3, eta: '22 min', price: '₹300 for two', image: img('photo-1568901346375-23c9450c58cd', 700) },
  { name: 'Bhopali Zaika', cuisine: 'North Indian · Kebabs', rating: 4.5, eta: '30 min', price: '₹400 for two', image: img('photo-1599487488170-d11ec9c172f0', 700) },
  { name: 'Chai & Chaat Corner', cuisine: 'Street Food · Chaat', rating: 4.7, eta: '18 min', price: '₹150 for two', image: img('photo-1601050690597-df0568f70950', 700) },
]

const RIDES = [
  { name: 'Bike', seats: '1 rider', note: 'Beat the traffic', icon: Bike },
  { name: 'Auto', seats: 'Up to 3', note: 'Everyday short hops', icon: Car },
  { name: 'Cab Mini', seats: 'Up to 4', note: 'Affordable AC rides', icon: Car },
  { name: 'Sedan', seats: 'Up to 4', note: 'Extra legroom', icon: Car },
  { name: 'SUV', seats: 'Up to 6', note: 'Family & airport', icon: Car },
  { name: 'Rentals', seats: 'Hourly', note: 'Car with driver', icon: Clock },
]

const STEPS = [
  { title: 'Pick a service', text: 'Food, groceries, a ride, a home pro or medicines. All in one app.', icon: Smartphone },
  { title: 'Confirm in seconds', text: 'Transparent prices up front. Pay by UPI, card, wallet or cash.', icon: Wallet },
  { title: 'Track it live', text: 'Watch your order, rider or professional arrive in real time.', icon: MapPin },
]

const WHY = [
  { title: 'Verified partners', text: 'Every driver, store and professional is KYC-checked before going live.', icon: ShieldCheck },
  { title: 'Lightning fast', text: 'Hyperlocal network built for minutes, not hours.', icon: Zap },
  { title: 'One wallet', text: 'One account and one wallet across every service, with cashback that stacks.', icon: Wallet },
  { title: 'Real humans', text: 'Local support teams that actually pick up, 7 days a week.', icon: Headphones },
]

const PARTNERS = [
  { title: 'Restaurants & Stores', text: 'List your kitchen, kirana or pharmacy and reach thousands of nearby customers.', cta: 'Become a partner', to: '/partner', icon: Store },
  { title: 'Drive with GoMark', text: 'Earn on your own schedule with bike, auto or cab. Weekly payouts, zero joining fee.', cta: 'Register as driver', to: '/taxi/signup', icon: Car },
  { title: 'Delivery Partners', text: 'Deliver food and groceries in your area. Flexible hours, daily earnings.', cta: 'Start delivering', to: '/food/delivery', icon: Bike },
]

const FAQS = [
  { q: 'Which cities is GoMark live in?', a: 'GoMark is live in Bhopal, with Indore and Nagpur rolling out next. Enter your location in the app to see what is available near you.' },
  { q: 'Do I need separate accounts for food, rides and services?', a: 'No. One GoMark account works across every service, with one wallet and one order history.' },
  { q: 'How do I pay?', a: 'UPI, debit and credit cards, net banking, the GoMark wallet, or cash on delivery where available.' },
  { q: 'Are the drivers and professionals verified?', a: 'Yes. Every partner goes through document and identity verification before they can accept a single order.' },
  { q: 'What are GoMark Public Service Centres?', a: 'Neighbourhood help points where you can get assistance with orders, bookings and partner sign-ups in person.' },
]

const STATS = [
  { value: '5', label: 'services, one app' },
  { value: '60+', label: 'home services' },
  { value: '100+', label: 'local partners' },
  { value: '24/7', label: 'rides & support' },
]

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
}

/* The speed stripes from the logo, reused as a decorative motif. */
function SpeedLines({ className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`} aria-hidden>
      {[56, 40, 64, 32].map((w, i) => (
        <span key={i} className="h-2 rounded-full" style={{ width: w, background: GRAD, opacity: 0.9 - i * 0.12 }} />
      ))}
    </div>
  )
}

function GradText({ children }) {
  return (
    <span className="bg-clip-text text-transparent" style={{ backgroundImage: GRAD }}>{children}</span>
  )
}

function SafeImg({ src, alt, className }) {
  const [ok, setOk] = useState(true)
  if (!ok) return <div className={`${className} bg-gradient-to-br from-lime-100 via-yellow-100 to-amber-100`} aria-label={alt} />
  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setOk(false)} />
}

function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12)
    on(); window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  const links = [['Services', '#services'], ['Popular', '#popular'], ['How it works', '#how'], ['Partners', '#partners'], ['FAQs', '#faq']]
  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-[0_1px_0_rgba(0,0,0,0.06)]' : 'bg-transparent'}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-20">
        <a href="#top" className="flex items-center"><img src={logo} alt="GoMark" className="h-10 w-auto sm:h-12 lg:h-14" /></a>
        <nav className="hidden items-center gap-8 lg:flex">
          {links.map(([n, h]) => (
            <a key={h} href={h} className="text-sm font-medium text-neutral-700 transition hover:text-black">{n}</a>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <Link to="/login" className="rounded-full px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100">Log in</Link>
          <Link to="/food/user" className="rounded-full bg-[#111] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/10 transition hover:-translate-y-0.5">Open GoMark</Link>
        </div>
        <button className="rounded-lg p-2 lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t border-neutral-100 bg-white lg:hidden">
            <div className="flex flex-col gap-1 px-4 py-4">
              {links.map(([n, h]) => (
                <a key={h} href={h} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 font-medium text-neutral-800 hover:bg-neutral-50">{n}</a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link to="/login" className="rounded-full border border-neutral-200 py-2.5 text-center font-semibold">Log in</Link>
                <Link to="/food/user" className="rounded-full bg-[#111] py-2.5 text-center font-semibold text-white">Open app</Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-24 sm:pt-28 lg:pt-32">
      {/* soft brand glow */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full opacity-30 blur-3xl" style={{ background: C.lime }} />
      <div className="pointer-events-none absolute -right-40 top-20 h-[520px] w-[520px] rounded-full opacity-25 blur-3xl" style={{ background: C.amber }} />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 sm:px-6 lg:grid-cols-2 lg:pb-24">
        <motion.div {...fadeUp}>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm backdrop-blur">
            <span className="flex h-2 w-2 rounded-full bg-[#8CC63F]" /> Now live in Bhopal
          </div>
          <h1 className="font-['Outfit'] text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-[#111] sm:text-6xl lg:text-7xl">
            Everything your city needs.{' '}
            <GradText>One app.</GradText>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
            Order food, get groceries in minutes, book a ride, call a trusted electrician or pick up
            medicines. GoMark brings your neighbourhood's best services to one place.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/food/user" className="group inline-flex items-center justify-center gap-2 rounded-full px-7 py-4 text-base font-bold text-[#111] shadow-xl shadow-amber-500/25 transition hover:-translate-y-0.5" style={{ background: GRAD }}>
              Start ordering <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
            </Link>
            <Link to="/taxi/user" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#111] px-7 py-4 text-base font-bold text-white transition hover:-translate-y-0.5">
              <Car className="h-5 w-5" /> Book a ride
            </Link>
          </div>
          <div className="mt-10 grid max-w-lg grid-cols-4 gap-4">
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="font-['Outfit'] text-2xl font-extrabold text-[#111] sm:text-3xl">{s.value}</div>
                <div className="mt-0.5 text-[11px] leading-tight text-neutral-500 sm:text-xs">{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Collage */}
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }} className="relative mx-auto w-full max-w-[560px]">
          <SpeedLines className="absolute -left-6 top-10 z-0 hidden sm:flex" />
          <div className="grid grid-cols-6 grid-rows-6 gap-3 sm:gap-4" style={{ aspectRatio: '1 / 1' }}>
            <div className="col-span-4 row-span-4 overflow-hidden rounded-[28px] shadow-2xl shadow-black/10">
              <SafeImg src={img('photo-1504674900247-0877df9cc836', 1000)} alt="Food" className="h-full w-full object-cover" />
            </div>
            <div className="col-span-2 row-span-3 overflow-hidden rounded-[24px] shadow-xl shadow-black/10">
              <SafeImg src={img('photo-1542838132-92c53300491e', 500)} alt="Groceries" className="h-full w-full object-cover" />
            </div>
            <div className="col-span-2 row-span-3 overflow-hidden rounded-[24px] shadow-xl shadow-black/10">
              <SafeImg src={img('photo-1587854692152-cbe660dbde88', 500)} alt="Pharmacy" className="h-full w-full object-cover" />
            </div>
            <div className="col-span-4 row-span-2 overflow-hidden rounded-[24px] shadow-xl shadow-black/10">
              <SafeImg src={img('photo-1449965408869-eaa3f722e40d', 900)} alt="Rides" className="h-full w-full object-cover" />
            </div>
          </div>

          {/* floating cards */}
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} className="absolute -bottom-4 left-2 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-2xl shadow-black/10 sm:-left-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: GRAD }}><CheckCircle2 className="h-5 w-5 text-[#111]" /></span>
            <div>
              <div className="text-sm font-bold text-[#111]">Order delivered</div>
              <div className="text-xs text-neutral-500">in 24 minutes · Arera Colony</div>
            </div>
          </motion.div>
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }} className="absolute -top-4 right-2 flex items-center gap-3 rounded-2xl bg-[#111] px-4 py-3 text-white shadow-2xl sm:-right-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5C400]"><Car className="h-5 w-5 text-[#111]" /></span>
            <div>
              <div className="text-sm font-bold">Driver arriving</div>
              <div className="text-xs text-neutral-300">3 min away · MP 04 AB 1234</div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

function Services() {
  return (
    <section id="services" className="relative bg-[#FAFAF7] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#8CC63F]">Our services</div>
          <h2 className="mt-3 font-['Outfit'] text-3xl font-extrabold tracking-tight text-[#111] sm:text-5xl">Five services. <span className="whitespace-nowrap"><GradText>Zero app-switching.</GradText></span></h2>
          <p className="mt-4 text-neutral-600">Everything you used to juggle across five apps, in one account and one wallet.</p>
        </motion.div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
          {SERVICES.map((s, i) => {
            const Icon = s.icon
            const wide = i < 2
            return (
              <motion.div key={s.key} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.06 }} className={wide ? 'lg:col-span-3' : 'lg:col-span-2'}>
                <Link to={s.to} className="group relative block h-full overflow-hidden rounded-[28px] bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(0,0,0,0.12)] transition hover:-translate-y-1 hover:shadow-[0_24px_60px_-16px_rgba(0,0,0,0.25)]">
                  <div className={`relative overflow-hidden ${wide ? 'h-64' : 'h-52'}`}>
                    <SafeImg src={s.image} alt={s.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0" />
                    <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-[#111]">{s.tag}</span>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: GRAD }}><Icon className="h-5 w-5 text-[#111]" /></span>
                      <h3 className="font-['Outfit'] text-xl font-bold text-[#111]">{s.title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-neutral-600">{s.blurb}</p>
                    <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[#111]">
                      Explore <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Popular() {
  return (
    <section id="popular" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div {...fadeUp} className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#FFA41B]"><MapPin className="h-3.5 w-3.5" /> Popular in Bhopal</div>
            <h2 className="mt-3 font-['Outfit'] text-3xl font-extrabold tracking-tight text-[#111] sm:text-5xl">Local favourites, delivered.</h2>
          </div>
          <Link to="/food/user" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#111] hover:underline">See all restaurants <ArrowRight className="h-4 w-4" /></Link>
        </motion.div>

        <div className="-mx-4 mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
          {RESTAURANTS.map((r, i) => (
            <motion.div key={r.name} {...fadeUp} transition={{ ...fadeUp.transition, delay: (i % 3) * 0.06 }} className="w-[78%] shrink-0 snap-start sm:w-auto">
              <Link to="/food/user" className="group block overflow-hidden rounded-3xl border border-neutral-100 bg-white transition hover:-translate-y-1 hover:shadow-xl">
                <div className="relative h-48 overflow-hidden">
                  <SafeImg src={r.image} alt={r.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-[#111]/85 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur"><Clock className="h-3 w-3" /> {r.eta}</span>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-['Outfit'] text-lg font-bold leading-snug text-[#111]">{r.name}</h3>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#8CC63F] px-2 py-0.5 text-xs font-bold text-white"><Star className="h-3 w-3 fill-white" /> {r.rating}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm text-neutral-500">
                    <span>{r.cuisine}</span><span>{r.price}</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Rides() {
  return (
    <section className="relative overflow-hidden bg-[#111] py-20 text-white sm:py-28">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-20 blur-3xl" style={{ background: C.yellow }} />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <motion.div {...fadeUp}>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#F5C400]">GoMark Rides</div>
          <h2 className="mt-3 font-['Outfit'] text-3xl font-extrabold tracking-tight sm:text-5xl">A ride for every trip, <GradText>every budget.</GradText></h2>
          <p className="mt-4 max-w-lg text-neutral-400">From a quick bike hop across MP Nagar to an SUV to the airport, see the fare before you book and track every kilometre.</p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {RIDES.map((r) => {
              const Icon = r.icon
              return (
                <div key={r.name} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-[#F5C400]/60 hover:bg-white/10">
                  <Icon className="h-6 w-6 text-[#F5C400]" />
                  <div className="mt-3 font-bold">{r.name}</div>
                  <div className="text-xs text-neutral-400">{r.seats} · {r.note}</div>
                </div>
              )
            })}
          </div>
          <Link to="/taxi/user" className="mt-8 inline-flex items-center gap-2 rounded-full px-7 py-4 font-bold text-[#111] transition hover:-translate-y-0.5" style={{ background: GRAD }}>
            Book your ride <ArrowRight className="h-5 w-5" />
          </Link>
        </motion.div>
        <motion.div {...fadeUp} className="relative">
          <div className="overflow-hidden rounded-[32px] border border-white/10">
            <SafeImg src={img('photo-1556122071-e404eaedb77f', 1100)} alt="GoMark rides" className="h-[420px] w-full object-cover" />
          </div>
          <div className="absolute -bottom-5 left-5 right-5 flex items-center justify-between gap-4 rounded-2xl bg-white p-4 text-[#111] shadow-2xl sm:left-8 sm:right-auto sm:w-80">
            <div>
              <div className="text-xs text-neutral-500">Upfront fare</div>
              <div className="font-['Outfit'] text-xl font-extrabold">Know before you go</div>
            </div>
            <ShieldCheck className="h-9 w-9 text-[#8CC63F]" />
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="how" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#8CC63F]">How it works</div>
          <h2 className="mt-3 font-['Outfit'] text-3xl font-extrabold tracking-tight text-[#111] sm:text-5xl">Three taps to done.</h2>
        </motion.div>
        <div className="relative mt-14 grid gap-6 md:grid-cols-3">
          <div className="absolute left-[16%] right-[16%] top-10 hidden h-1 rounded-full md:block" style={{ background: GRAD, opacity: 0.35 }} />
          {STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <motion.div key={s.title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }} className="relative rounded-3xl bg-white p-8 text-center">
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl shadow-lg shadow-amber-500/20" style={{ background: GRAD }}>
                  <Icon className="h-8 w-8 text-[#111]" />
                  <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#111] text-xs font-bold text-white">{i + 1}</span>
                </div>
                <h3 className="mt-6 font-['Outfit'] text-xl font-bold text-[#111]">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{s.text}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function WhyUs() {
  return (
    <section className="bg-[#FAFAF7] py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <motion.div {...fadeUp} className="relative order-2 lg:order-1">
          <div className="grid grid-cols-2 gap-4">
            <SafeImg src={img('photo-1621905251189-08b45d6a269e', 600)} alt="Electrician at work" className="h-72 w-full rounded-3xl object-cover" />
            <SafeImg src={img('photo-1526367790999-0150786686a2', 600)} alt="Delivery partner" className="mt-10 h-72 w-full rounded-3xl object-cover" />
          </div>
          <div className="absolute -bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#111] px-5 py-3 text-white shadow-2xl">
            <Users className="h-5 w-5 text-[#F5C400]" />
            <span className="whitespace-nowrap text-sm font-semibold">Public Service Centres near you</span>
          </div>
        </motion.div>
        <motion.div {...fadeUp} className="order-1 lg:order-2">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFA41B]">Why GoMark</div>
          <h2 className="mt-3 font-['Outfit'] text-3xl font-extrabold tracking-tight text-[#111] sm:text-5xl">Built for your neighbourhood.</h2>
          <p className="mt-4 text-neutral-600">GoMark is more than an app. Our Public Service Centres put real people on the ground to help customers and onboard local businesses.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {WHY.map((w) => {
              const Icon = w.icon
              return (
                <div key={w.title} className="rounded-2xl bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_30px_-12px_rgba(0,0,0,0.1)]">
                  <Icon className="h-6 w-6 text-[#8CC63F]" />
                  <div className="mt-3 font-bold text-[#111]">{w.title}</div>
                  <div className="mt-1 text-sm text-neutral-600">{w.text}</div>
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function Partners() {
  return (
    <section id="partners" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#8CC63F]">Grow with us</div>
          <h2 className="mt-3 font-['Outfit'] text-3xl font-extrabold tracking-tight text-[#111] sm:text-5xl">Partner with <GradText>GoMark</GradText></h2>
          <p className="mt-4 text-neutral-600">Join the network powering Bhopal's everyday. More orders, faster payouts, real support.</p>
        </motion.div>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {PARTNERS.map((p, i) => {
            const Icon = p.icon
            return (
              <motion.div key={p.title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }} className="group flex flex-col rounded-[28px] border border-neutral-200 bg-white p-7 transition hover:-translate-y-1 hover:border-transparent hover:shadow-[0_24px_60px_-16px_rgba(0,0,0,0.2)]">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#111]"><Icon className="h-6 w-6 text-[#F5C400]" /></span>
                <h3 className="mt-6 font-['Outfit'] text-2xl font-bold text-[#111]">{p.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600">{p.text}</p>
                <Link to={p.to} className="mt-6 inline-flex items-center justify-center gap-2 rounded-full border-2 border-[#111] px-5 py-3 text-sm font-bold text-[#111] transition group-hover:border-transparent" style={{}} onMouseEnter={(e) => { e.currentTarget.style.background = GRAD }} onMouseLeave={(e) => { e.currentTarget.style.background = '' }}>
                  {p.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function AppBanner() {
  return (
    <section className="px-4 pb-20 sm:px-6 sm:pb-28">
      <motion.div {...fadeUp} className="relative mx-auto max-w-7xl overflow-hidden rounded-[36px] px-6 py-14 sm:px-14 sm:py-20" style={{ background: GRAD }}>
        <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-white/20 blur-2xl" />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#111] px-3 py-1 text-xs font-bold text-[#F5C400]"><Sparkles className="h-3.5 w-3.5" /> Flat ₹50 off your first order</div>
            <h2 className="mt-5 font-['Outfit'] text-3xl font-extrabold leading-tight tracking-tight text-[#111] sm:text-5xl">Your city, on the go. <br className="hidden sm:block" />Start with GoMark today.</h2>
            <p className="mt-4 max-w-lg font-medium text-[#111]/75">Use code <span className="rounded-md bg-[#111] px-2 py-0.5 font-bold text-white">DEMO50</span> on your first food order.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/food/user" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#111] px-7 py-4 font-bold text-white transition hover:-translate-y-0.5">Open GoMark <ArrowRight className="h-5 w-5" /></Link>
              <Link to="/login" className="inline-flex items-center justify-center rounded-full border-2 border-[#111] px-7 py-4 font-bold text-[#111] transition hover:bg-[#111] hover:text-white">Create account</Link>
            </div>
          </div>
          <div className="relative hidden justify-center lg:flex">
            <div className="rounded-[28px] bg-white p-6 shadow-2xl">
              <img src={logo} alt="GoMark" className="w-72" />
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

function FAQ() {
  const [open, setOpen] = useState(0)
  return (
    <section id="faq" className="bg-[#FAFAF7] py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <motion.div {...fadeUp} className="text-center">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFA41B]">FAQs</div>
          <h2 className="mt-3 font-['Outfit'] text-3xl font-extrabold tracking-tight text-[#111] sm:text-5xl">Questions? Answered.</h2>
        </motion.div>
        <div className="mt-12 space-y-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i
            return (
              <div key={f.q} className={`overflow-hidden rounded-2xl border bg-white transition ${isOpen ? 'border-[#F5C400] shadow-lg shadow-amber-500/10' : 'border-neutral-200'}`}>
                <button onClick={() => setOpen(isOpen ? -1 : i)} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left">
                  <span className="font-semibold text-[#111]">{f.q}</span>
                  <ChevronDown className={`h-5 w-5 shrink-0 transition ${isOpen ? 'rotate-180 text-[#FFA41B]' : 'text-neutral-400'}`} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                      <p className="px-6 pb-5 text-sm leading-relaxed text-neutral-600">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const cols = [
    ['Services', [['Food Delivery', '/food/user'], ['Grocery', '/food/user'], ['Rides', '/taxi/user'], ['Home Services', '/food/user'], ['Pharmacy', '/food/user']]],
    ['Partners', [['Restaurants & Stores', '/partner'], ['Drive with us', '/taxi/signup'], ['Deliver with us', '/food/delivery']]],
    ['Company', [['Help & Support', '/support'], ['Terms of Service', '/terms'], ['Privacy Policy', '/privacy']]],
  ]
  return (
    <footer className="bg-[#111] pt-16 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 border-b border-white/10 pb-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="inline-block rounded-2xl bg-white p-3"><img src={logo} alt="GoMark" className="h-10 w-auto" /></div>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-neutral-400">Food, groceries, rides, home services and medicines in one app, with Public Service Centres in your neighbourhood.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {['Bhopal', 'Indore', 'Nagpur'].map((c, i) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-xs text-neutral-300">
                  <MapPin className="h-3 w-3" /> {c}{i > 0 && <span className="text-neutral-500"> · soon</span>}
                </span>
              ))}
            </div>
          </div>
          {cols.map(([title, items]) => (
            <div key={title}>
              <div className="text-sm font-bold text-[#F5C400]">{title}</div>
              <ul className="mt-4 space-y-3">
                {items.map(([n, h]) => (
                  <li key={n}><Link to={h} className="text-sm text-neutral-400 transition hover:text-white">{n}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center justify-between gap-3 py-6 text-xs text-neutral-500 sm:flex-row">
          <span>© {new Date().getFullYear()} GoMark Public Service Centres. All rights reserved.</span>
          <span className="h-1.5 w-24 rounded-full" style={{ background: GRAD }} />
        </div>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  useEffect(() => {
    document.title = 'GoMark | Food, Groceries, Rides & Home Services in One App'
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', 'GoMark brings food delivery, grocery in minutes, rides, home services and pharmacy together in one app. Now live in Bhopal.')
  }, [])

  return (
    <div className="min-h-screen overflow-x-clip bg-white text-[#111] antialiased" style={{ fontFamily: "'Poppins', system-ui, sans-serif", scrollBehavior: 'smooth' }}>
      <Navbar />
      <main>
        <Hero />
        <Services />
        <Popular />
        <Rides />
        <HowItWorks />
        <WhyUs />
        <Partners />
        <AppBanner />
        <FAQ />
      </main>
      <Footer />
    </div>
  )
}
