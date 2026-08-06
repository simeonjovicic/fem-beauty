export const BOOKING_URL = 'https://trea.tw/uc3hWqqxxVC9uu2Yj'

// Grenzen für Gutscheinwerte. Bewusst hier und nicht in der Komponente:
// der Worker importiert dieselben Werte, damit Client- und Serverprüfung
// nicht auseinanderlaufen können. Die Prüfung im Browser ist Komfort,
// die im Worker ist die verbindliche.
export const VOUCHER_MIN_AMOUNT = 25
export const VOUCHER_MAX_AMOUNT = 500
export const VOUCHER_MAX_MESSAGE_LENGTH = 180

// Curated treatments with a clear fixed price in FEM's public booking menu.
// Keeping this list intentionally small makes a treatment voucher feel selected,
// while the regular value voucher remains available for every other service.
export const voucherTreatments = [
  {
    id: 'head-spa-pure-balance',
    category: 'Head Spa',
    title: 'The Head Spa',
    variant: 'Pure Balance',
    duration: '70 Min.',
    price: 105,
  },
  {
    id: 'head-spa-scalp-balance',
    category: 'Head Spa',
    title: 'The Head Spa',
    variant: 'Scalp Balance',
    duration: '80 Min.',
    price: 118,
  },
  {
    id: 'head-spa-glow-flow',
    category: 'Head Spa',
    title: 'The Head Spa',
    variant: 'Glow & Flow',
    duration: '100 Min.',
    price: 155,
  },
  {
    id: 'hydro-glow',
    category: 'Gesicht',
    title: 'Hydro Glow',
    variant: 'High-Tech Facial',
    duration: '70 Min.',
    price: 120,
  },
  {
    id: 'japanische-manikuere',
    category: 'Nägel',
    title: 'Japanische Maniküre',
    variant: 'Natürlicher Glanz',
    duration: '45 Min.',
    price: 38,
  },
  {
    id: 'premium-handpflege-pure',
    category: 'Hände',
    title: 'Premium Handpflege',
    variant: 'Vital · Pure',
    duration: '30 Min.',
    price: 48,
  },
]

export const services = [
  {
    id: 'face',
    number: '01',
    title: 'Gesichtsbehandlungen',
    expandedTitle: 'Gesichts\u00ADbehandlungen',
    summary: 'Individuelle Hautpflege — von klassischer Kosmetik bis zu modernen High-Tech Treatments.',
    description:
      'Klassische Gesichtspflege, Fruchtsäure-Treatments, Körperbehandlungen sowie innovative High-Tech Methoden: Hydro Peel, Carbon Laser, HIFU & Radiofrequenz. Individuelle Hautanalyse mit iS Clinical, Babor & Fillmed.',
    tags: ['Klassisch', 'Fruchtsäure', 'Hydro Peel', 'Carbon Laser', 'HIFU', 'Radiofrequenz'],
  },
  {
    id: 'hands',
    number: '02',
    title: 'Premium Handpflege Vital',
    description:
      'Unsere Premium Handpflege Vital vereint Infrarotwärme, Peeling, Ultraschall sowie eine Kollagenbehandlung mit Wirkessenz. Sie spendet langanhaltende Feuchtigkeit, fördert die Hautregeneration und verbessert die Elastizität – für glatte, jugendlich strahlende Hände.',
    tags: ['Infrarotwärme', 'Peeling', 'Ultraschall', 'Kollagen'],
  },
  {
    id: 'nails',
    number: '03',
    title: 'Maniküre & Pediküre',
    summary: 'Präzise Hand- und Fußpflege — klassisch, mit Gel oder als individuelles Nail Design.',
    description:
      'Professionelle Hand- und Fußpflege, Gel-Nägel & kreatives Nail Art. Von klassisch elegant bis ausgefallen — unsere Designerinnen verwirklichen jeden Wunsch mit Präzision.',
    tags: ['Maniküre', 'Pediküre', 'Gel', 'Nail Art', 'Fußpflege'],
  },
  {
    id: 'waxing',
    number: '04',
    title: 'Waxing',
    description:
      'Professionelles Waxing für seidig glatte Haut. Schnell, sauber und schonend — für alle Körperbereiche. Langanhaltende Ergebnisse mit minimaler Irritation.',
    tags: ['Ganzkörper', 'Gesicht', 'Bikini', 'Beine'],
  },
  {
    id: 'laser',
    number: '05',
    title: 'Laser-Haarentfernung',
    description:
      'Dauerhaft glatte Haut ohne Rasur. Kein Diodenlaser sondern IPL Laser für alle Hauttypen — schonend, effektiv und langanhaltend.',
    tags: ['IPL Laser', 'Ganzkörper', 'Schmerzarm', 'Dauerhaft'],
  },
  {
    id: 'lash',
    number: '06',
    title: 'Brauen & Wimpern',
    expandedTitle: 'Augenbrauen- & Wimpernstyling',
    description:
      'Wimpernlifting, Lash Extensions, Augenbrauen-Styling & Färben. Für den perfekten Augenaufschlag — natürlich oder dramatisch, ganz nach deinem Wunsch.',
    tags: ['Lash Lift', 'Extensions', 'Brow Styling', 'Färben'],
  },
]

// Eigene Sektion statt Kachel im Raster: Head Spa ist das Signature-Treatment
// und traegt als einziges mehrere buchbare Varianten. Die stehen bereits in
// voucherTreatments — hier nur die Beschreibung, die Varianten leitet die
// Komponente von dort ab, damit Preise nicht an zwei Stellen gepflegt werden.
export const headSpa = {
  id: 'headspa',
  title: 'Japanische Head Spa',
  summary: 'Tiefenpflege, Massage und vollkommene Entspannung für Kopfhaut, Haar und Sinne.',
  description:
    'Premium Head Spa mit NewSha Produkten. Tiefenreinigende Kopfhautpflege, wohltuende Massage & pure Entspannung — ein unvergessliches Erlebnis für Haar & Seele.',
  tags: ['NewSha', 'Kopfhautpflege', 'Massage', 'Entspannung'],
}

export const reviews = [
  {
    platform: 'google',
    name: 'Theresa',
    service: 'Nägel · bei Timea',
    text: '„Ich bin absolut begeistert vom Fem Studio, wo Timi meine Nägel macht. Die Atmosphäre ist immer angenehm, sauber und hygienisch. Timi arbeitet professionell und mit viel Liebe zum Detail. Jedes Mal verlasse ich das Studio mit wunderschönen Nägeln und einem glücklichen Lächeln."',
  },
  {
    platform: 'treatwell',
    name: 'Iva',
    service: 'Maniküre · bei Vicky',
    text: '„Maniküre war sensationell! Für meine Tochter und mich war es perfekt. Sehr angenehm und sauber gearbeitet. Kommen sicher wieder!"',
  },
  {
    platform: 'treatwell',
    name: 'Jana',
    service: 'Gesichtsbehandlung · bei Jenny',
    text: '„Jennys Behandlungen sind jedes Mal eine Wohltat, meine Haut ist danach ganz weich und auch meine Akne wurde so viel besser."',
  },
  {
    platform: 'google',
    name: 'Diana',
    service: 'Gesichtsbehandlung · bei Jenny',
    text: '„FEM ist ein großartiges Studio! Der Empfang war sehr freundlich, es wurde mir Tee oder Kaffee angeboten. Die Facial-Behandlung war fenomenal — hier möchte ich Jenny einen großen Lob aussprechen. Kann das Studio einfach weiterempfehlen."',
  },
  {
    platform: 'google',
    name: 'Lucia',
    service: 'Gesichtsbehandlung · Maniküre · Pediküre',
    text: '„I\'ve had facial treatments, manicures, and pedicures here, and each experience has been excellent. I can confidently say they are all talented, friendly, and genuinely passionate professionals. The salon is spotless, and the atmosphere is incredibly relaxing!"',
  },
  {
    platform: 'treatwell',
    name: 'Marei',
    service: 'Head Spa',
    text: '„Habe mit einer Freundin den Head Spa gemacht und es war soo gut! So beruhigend und mega entspannend! Absolut super weiterzuempfehlen."',
  },
  {
    platform: 'treatwell',
    name: 'Emma',
    service: 'Gesichtsbehandlung · bei Jenny',
    text: '„Very nice experience! The atmosphere is very relaxing and the treatment was great! Did not trigger my rosacea — thank you!"',
  },
  {
    platform: 'google',
    name: 'Xian',
    service: 'Maniküre mit Design',
    text: '„Ich bin super zufrieden! Meine Maniküre mit Design wurde sehr sorgfältig und professionell gemacht. Die Nägel sehen wunderschön aus, halten lange und das Design ist genau so geworden, wie ich es mir gewünscht habe. Absolut empfehlenswert!"',
  },
  {
    platform: 'google',
    name: 'Bianca',
    service: 'Nägel · bei Vicky',
    text: '„Vicky was patient and attentive to the details. She explained every design option as a new client and was very accommodating. The ambience was very cozy and the music is very calm and relaxing. Great experience overall."',
  },
  {
    platform: 'treatwell',
    name: 'Caroline',
    service: 'Maniküre · bei Vicky',
    text: '„Ich habe eine wunderbare Maniküre mit Shellack bekommen. Das Personal ist unglaublich freundlich und aufmerksam."',
  },
  {
    platform: 'google',
    name: 'H & F',
    service: 'Maniküre',
    text: '„Best and cutest nail salon in the 5th / Vienna 💕 Love the atmosphere and the ladies working there! Impeccable manicure every time and it lasts much longer than others. Highly recommend!!"',
  },
  {
    platform: 'treatwell',
    name: 'Jelena',
    service: 'Peeling · bei Jenny',
    text: '„Es war wieder ein Genuss sich von Jenny behandeln zu lassen. Sie hat wirklich magische Hände. Danke 🌼"',
  },
  {
    platform: 'google',
    name: 'K Laura',
    service: 'Nägel · bei Timea',
    text: '„Ich gehe seit Jahren zu Timi und bin jedes Mal rundum zufrieden — einfach die Beste! 😊 Vor der Behandlung bekommt man Kaffee oder Tee angeboten, es gibt eine riesige Farbauswahl und alle Mitarbeiterinnen sind super nett."',
  },
  {
    platform: 'treatwell',
    name: 'Ashish',
    service: 'Maniküre · bei Nasim',
    text: '„Nasim was amazing! She was very professional, attentive to detail, and made sure everything was perfect."',
  },
  {
    platform: 'treatwell',
    name: 'Andrea',
    service: 'Maniküre · bei Vicky',
    text: '„Tolle und sehr gründliche Maniküre. Vicky ist sehr talentiert und nett. Angenehme Atmosphäre. Komme gerne wieder."',
  },
  {
    platform: 'google',
    name: 'Jelena V.',
    service: 'Maniküre & Pediküre · bei Timea',
    text: '„Bin schon öfters bei Timea gewesen — bin sehr zufrieden! Sie ist sehr lieb und einfühlsam. Die Maniküre und Pediküre wird immer sehr genau und schön gemacht. Sehr empfehlenswert!"',
  },
  {
    platform: 'google',
    name: 'Luxy',
    service: 'Gesichtsbehandlung',
    text: '„Fem provided an exceptional experience. The staff was kind, professional, and attentive, creating a welcoming atmosphere. The session was incredibly relaxing, with gentle touches and soothing music. The overall experience was top-notch!!"',
  },
  {
    platform: 'treatwell',
    name: 'Jacqueline',
    service: 'Gesichtsbehandlung · bei Jenny',
    text: '„Sehr kompetent, hab mich wirklich entspannen können und war mit der Behandlung sehr zufrieden!"',
  },
  {
    platform: 'google',
    name: 'Jessy',
    service: 'Gesichtsbehandlung · bei Jenny',
    text: '„Die Gesichtsmassage ist einfach mein Highlight, die Jeni beratet zuerst und dann geht schon die Gesichtsreinigung los! 🧖‍♀️"',
  },
  {
    platform: 'google',
    name: 'Miriam',
    service: 'Gesichtsbehandlung',
    text: '„Einfach toll! Atmosphäre, Sauberkeit und Professionalität sind top. Auf die eigenen Bedürfnisse wird eingegangen und die entsprechende Behandlung empfohlen. Sehr empfehlenswert :)"',
  },
  {
    platform: 'treatwell',
    name: 'Bianca',
    service: 'Maniküre · bei Vicky',
    text: '„Wie immer super Maniküre mit UV Lack — hält sehr sehr gut und ist gut verträglich für die Nägel."',
  },
  {
    platform: 'google',
    name: 'Laura',
    service: 'Nägel · bei Vicky',
    text: '„Sehr liebevolle Mitarbeiter und immer hilfsbereit 😊 Großen Lob an die Vicky für die tolle Arbeit!"',
  },
  {
    platform: 'google',
    name: 'Natalie',
    service: 'Nägel',
    text: '„Ich habe bei einem gebrochenen Nagel super schnell & preiswert Hilfe bekommen. Richtig freundliches & kompetentes Studio!"',
  },
  {
    platform: 'google',
    name: 'Alexandra',
    service: 'Maniküre',
    text: '„Ein sehr gemütlicher Ort mit freundlichen Mädchen und schneller, hochwertiger Maniküre. 🥰"',
  },
]
