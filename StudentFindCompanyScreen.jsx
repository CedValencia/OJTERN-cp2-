import React, { useState, useRef, useEffect } from "react";
import reportIcon from "../icons/report.png";
import { ApplyModal } from "./StudentApplicationScreen";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";

const MAPBOX_TOKEN = "pk.eyJ1IjoibWFraWlpaS0iLCJhIjoiY21wbTgybHVmMmc1ZzJycTFuZXRlb3NoNCJ9.FIpjF2lKTHkbU1e6qrL_Pw";

// ── Mapbox read-only map view (shown in company/post profile) ─────────────────
const MapboxStaticView = ({ lat, lng, address }) => {
  const mapContainer = useRef(null);
  const mapRef       = useRef(null);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    if (!lat || !lng) return;

    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
    document.head.appendChild(link);

    const initMap = () => {
      const mapboxgl = window.mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [lng, lat],
        zoom: 15,
        interactive: true,
      });
      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      new mapboxgl.Marker({ color: "#8B0000" }).setLngLat([lng, lat]).addTo(map);
      mapRef.current = map;
    };

    if (window.mapboxgl) { initMap(); return; }
    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
    script.onload = initMap;
    document.head.appendChild(script);
  }, [lat, lng]);

  if (!lat || !lng) {
    return (
      <div style={{ width: "100%", minHeight: "200px", borderRadius: "14px", background: "#d0d8e0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px" }}>
        <svg width="30" height="36" viewBox="0 0 24 30" fill="#8B0000"><path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 16 8 16s8-10.75 8-16c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/></svg>
        <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.75rem", color: "#555", textAlign: "center", padding: "0 12px" }}>{address || "No location set"}</span>
      </div>
    );
  }

  return <div ref={mapContainer} style={{ width: "100%", height: "300px", borderRadius: "14px", overflow: "hidden" }} />;
};

// ─── COLORS ───────────────────────────────────────────────────────────────────
const red     = "#8B0000";
const darkRed = "#590101";

// ─── REGIONS ─────────────────────────────────────────────────────────────────
// TODO: Populate from backend — list of regions > provinces > cities > barangays
const REGIONS = [
  {
    name: "Region I – Ilocos Region",
    provinces: [
      { name: "Ilocos Norte", cities: ["Laoag","Batac","Adams","Bacarra","Badoc","Bangui","Banna","Burgos","Carasi","Currimao","Dingras","Dumalneg","Marcos","Nueva Era","Pagudpud","Paoay","Pasuquin","Piddig","Pinili","San Nicolas","Sarrat","Solsona","Vintar"] },
      { name: "Ilocos Sur", cities: ["Vigan","Candon","Alilem","Banayoyo","Bantay","Burgos","Cabugao","Caoayan","Cervantes","Galimuyod","Gregorio del Pilar","Lidlidda","Magsingal","Nagbukel","Narvacan","Quirino","Salcedo","San Emilio","San Esteban","San Ildefonso","San Juan","San Vicente","Santa","Santa Catalina","Santa Cruz","Santa Lucia","Santa Maria","Santiago","Sigay","Sinait","Sugpon","Suyo","Tagudin"] },
      { name: "La Union", cities: ["San Fernando","Agoo","Aringay","Bacnotan","Bagulin","Balaoan","Bangar","Bauang","Burgos","Caba","Luna","Naguilian","Pugo","Rosario","San Gabriel","San Juan","Santo Tomas","Santol","Sudipen","Tubao"] },
      { name: "Pangasinan", cities: ["Dagupan","San Carlos","Urdaneta","Alaminos","Agno","Aguilar","Alcala","Anda","Asingan","Balungao","Bani","Basista","Bautista","Bayambang","Binalonan","Binmaley","Bolinao","Bugallon","Burgos","Calasiao","Dasol","Infanta","Labrador","Laoac","Lingayen","Mabini","Malasiqui","Manaoag","Mangaldan","Mangatarem","Mapandan","Natividad","Pozorrubio","Rosales","San Fabian","San Jacinto","San Manuel","San Nicolas","San Quintin","Santa Barbara","Santa Maria","Santo Tomas","Sison","Sual","Tayug","Umingan","Urbiztondo","Villasis"] },
    ]
  },
  {
    name: "Region II – Cagayan Valley",
    provinces: [
      { name: "Batanes", cities: ["Basco","Itbayat","Ivana","Mahatao","Sabtang","Uyugan"] },
      { name: "Cagayan", cities: ["Tuguegarao","Abulug","Alcala","Allacapan","Amulung","Aparri","Baggao","Ballesteros","Buguey","Calayan","Camalaniugan","Claveria","Enrile","Gattaran","Gonzaga","Iguig","Lal-lo","Lasam","Pamplona","Peñablanca","Piat","Rizal","Sanchez-Mira","Santa Ana","Santa Praxedes","Santa Teresita","Santo Nino","Solana","Tuao"] },
      { name: "Isabela", cities: ["Ilagan","Cauayan","Santiago","Alicia","Angadanan","Aurora","Benito Soliven","Burgos","Cabagan","Cabatuan","Cordon","Delfin Albano","Dinapigue","Divilacan","Echague","Gamu","Jones","Luna","Maconacon","Mallig","Naguilian","Palanan","Quezon","Quirino","Ramon","Reina Mercedes","Roxas","San Agustin","San Guillermo","San Isidro","San Manuel","San Mariano","San Mateo","San Pablo","Santa Maria","Santo Tomas","Tumauini"] },
      { name: "Nueva Vizcaya", cities: ["Bayombong","Bambang","Aritao","Bagabag","Diadi","Dupax del Norte","Dupax del Sur","Kasibu","Kayapa","Quezon","Santa Fe","Solano","Villaverde"] },
      { name: "Quirino", cities: ["Cabarroguis","Aglipay","Diffun","Maddela","Nagtipunan","Saguday"] },
    ]
  },
  {
    name: "Region III – Central Luzon",
    provinces: [
      { name: "Aurora", cities: ["Baler","Casiguran","Dilasag","Dinalungan","Dingalan","Dipaculao","Maria Aurora","San Luis"] },
      { name: "Bataan", cities: ["Balanga","Abucay","Bagac","Dinalupihan","Hermosa","Limay","Mariveles","Morong","Orani","Orion","Pilar","Samal"] },
      { name: "Bulacan", cities: ["Malolos","Meycauayan","San Jose del Monte","Angat","Balagtas","Baliuag","Bocaue","Bulakan","Bustos","Calumpit","Doña Remedios Trinidad","Guiguinto","Hagonoy","Marilao","Norzagaray","Obando","Pandi","Paombong","Plaridel","Pulilan","San Ildefonso","San Miguel","San Rafael","Santa Maria"] },
      { name: "Nueva Ecija", cities: ["Cabanatuan","Gapan","Muñoz","Palayan","San Jose","Aliaga","Bongabon","Cabiao","Carranglan","Cuyapo","Gabaldon","General Mamerto Natividad","General Tinio","Guimba","Jaen","Laur","Licab","Llanera","Lupao","Nampicuan","Pantabangan","Peñaranda","Quezon","Rizal","San Antonio","San Isidro","San Leonardo","Santa Rosa","Santo Domingo","Science City of Muñoz","Talavera","Talugtug","Zaragoza"] },
      { name: "Pampanga", cities: ["Angeles","San Fernando","Apalit","Arayat","Bacolor","Candaba","Floridablanca","Guagua","Lubao","Mabalacat","Macabebe","Magalang","Masantol","Mexico","Minalin","Porac","San Luis","San Simon","Santa Ana","Santa Rita","Santo Tomas","Sasmuan"] },
      { name: "Tarlac", cities: ["Tarlac City","Anao","Bamban","Camiling","Capas","Concepcion","Gerona","La Paz","Mayantoc","Moncada","Paniqui","Pura","Ramos","San Clemente","San Jose","San Manuel","Santa Ignacia","Victoria"] },
      { name: "Zambales", cities: ["Olongapo","Botolan","Cabangan","Candelaria","Castillejos","Iba","Masinloc","Palauig","San Antonio","San Felipe","San Marcelino","San Narciso","Santa Cruz","Subic"] },
    ]
  },
  {
    name: "Region IV-A – CALABARZON",
    provinces: [
      { name: "Batangas", cities: ["Batangas City","Lipa","Tanauan","Agoncillo","Alitagtag","Balayan","Balete","Bauan","Calaca","Calatagan","Cuenca","Ibaan","Laurel","Lemery","Lian","Lobo","Mabini","Malvar","Mataas na Kahoy","Nasugbu","Padre Garcia","Rosario","San Jose","San Juan","San Luis","San Nicolas","San Pascual","Santa Teresita","Santo Tomas","Taal","Talisay","Taysan","Tingloy","Tuy"] },
      { name: "Cavite", cities: ["Cavite City","Bacoor","Dasmariñas","General Trias","Imus","Tagaytay","Trece Martires","Alfonso","Amadeo","Carmona","General Mariano Alvarez","Indang","Kawit","Magallanes","Maragondon","Mendez","Naic","Noveleta","Rosario","Silang","Tanza","Ternate"] },
      { name: "Laguna", cities: ["San Pablo","Biñan","Calamba","Santa Rosa","Cabuyao","San Pedro","Alaminos","Bay","Calauan","Cavinti","Famy","Kalayaan","Liliw","Los Baños","Luisiana","Lumban","Mabitac","Magdalena","Majayjay","Nagcarlan","Paete","Pagsanjan","Pakil","Pangil","Pila","Rizal","Santa Cruz","Santa Maria","Siniloan","Victoria"] },
      { name: "Quezon", cities: ["Lucena","Tayabas","Agdangan","Alabat","Atimonan","Buenavista","Burdeos","Calauag","Candelaria","Catanauan","Dolores","General Luna","General Nakar","Guinayangan","Gumaca","Infanta","Jomalig","Lopez","Lucban","Macalelon","Mauban","Mulanay","Padre Burgos","Pagbilao","Panukulan","Patnanungan","Perez","Pitogo","Plaridel","Polillo","Quezon","Real","Sampaloc","San Andres","San Antonio","San Francisco","San Narciso","Sariaya","Tagkawayan","Tiaong","Unisan"] },
      { name: "Rizal", cities: ["Antipolo","Angono","Baras","Binangonan","Cainta","Cardona","Jala-Jala","Montalban","Morong","Navotas","Pateros","Pililla","Rodriguez","San Mateo","Taytay","Teresa"] },
    ]
  },
  {
    name: "Region IV-B – MIMAROPA",
    provinces: [
      { name: "Marinduque", cities: ["Boac","Buenavista","Gasan","Mogpog","Santa Cruz","Torrijos"] },
      { name: "Occidental Mindoro", cities: ["Mamburao","Abra de Ilog","Calintaan","Looc","Lubang","Magsaysay","Paluan","Rizal","Sablayan","San Jose","Santa Cruz"] },
      { name: "Oriental Mindoro", cities: ["Calapan","Baco","Bansud","Bongabong","Bulalacao","Gloria","Mansalay","Naujan","Pinamalayan","Pola","Puerto Galera","Roxas","San Teodoro","Socorro","Victoria"] },
      { name: "Palawan", cities: ["Puerto Princesa","Aborlan","Agutaya","Araceli","Balabac","Bataraza","Brooke's Point","Busuanga","Cagayancillo","Coron","Culion","Cuyo","Dumaran","El Nido","Kalayaan","Linapacan","Magsaysay","Narra","Quezon","Rizal","Roxas","San Vicente","Sofronio Española","Taytay"] },
      { name: "Romblon", cities: ["Romblon","Alcantara","Banton","Cajidiocan","Calatrava","Concepcion","Corcuera","Ferrol","Looc","Magdiwang","Odiongan","San Agustin","San Andres","San Fernando","Santa Fe","Santa Maria"] },
    ]
  },
  {
    name: "Region V – Bicol Region",
    provinces: [
      { name: "Albay", cities: ["Legazpi","Ligao","Tabaco","Bacacay","Camalig","Daraga","Guinobatan","Jovellar","Libon","Malilipot","Malinao","Manito","Oas","Pio Duran","Polangui","Rapu-Rapu","Santo Domingo","Tiwi"] },
      { name: "Camarines Norte", cities: ["Daet","Basud","Capalonga","Jose Panganiban","Labo","Mercedes","Paracale","San Lorenzo Ruiz","San Vicente","Santa Elena","Talisay","Vinzons"] },
      { name: "Camarines Sur", cities: ["Naga","Iriga","Baao","Balatan","Bato","Bombon","Buhi","Bula","Cabusao","Calabanga","Camaligan","Canaman","Caramoan","Del Gallego","Gainza","Garchitorena","Goa","Lagonoy","Libmanan","Lupi","Magarao","Milaor","Minalabac","Nabua","Ocampo","Pamplona","Pasacao","Pili","Presentacion","Ragay","Sagñay","San Fernando","San Jose","Sipocot","Siruma","Tigaon","Tinambac"] },
      { name: "Catanduanes", cities: ["Virac","Bagamanoc","Baras","Bato","Caramoran","Gigmoto","Pandan","Panganiban","San Andres","San Miguel","Viga"] },
      { name: "Masbate", cities: ["Masbate City","Aroroy","Baleno","Balud","Batuan","Cataingan","Cawayan","Claveria","Dimasalang","Esperanza","Mandaon","Milagros","Mobo","Monreal","Palanas","Pio V. Corpuz","Placer","San Fernando","San Jacinto","San Pascual","Uson"] },
      { name: "Sorsogon", cities: ["Sorsogon City","Barcelona","Bulan","Bulusan","Casiguran","Castilla","Donsol","Gubat","Irosin","Juban","Magallanes","Matnog","Pilar","Prieto Diaz","Santa Magdalena"] },
    ]
  },
  {
    name: "Region VI – Western Visayas",
    provinces: [
      { name: "Aklan", cities: ["Kalibo","Altavas","Balete","Banga","Batan","Buruanga","Ibajay","Lezo","Libacao","Madalag","Makato","Malay","Malinao","Nabas","New Washington","Numancia","Tangalan"] },
      { name: "Antique", cities: ["San Jose de Buenavista","Anini-y","Barbaza","Belison","Bugasong","Caluya","Culasi","Hamtic","Laua-an","Libertad","Pandan","Patnongon","San Remigio","Sebaste","Sibalom","Tibiao","Tobias Fornier","Valderrama"] },
      { name: "Capiz", cities: ["Roxas City","Cuartero","Dao","Dumalag","Dumarao","Ivisan","Jamindan","Ma-ayon","Mambusao","Panay","Panitan","Pilar","Pontevedra","President Roxas","Sapian","Sigma","Tapaz"] },
      { name: "Guimaras", cities: ["Jordan","Buenavista","Nueva Valencia","San Lorenzo","Sibunag"] },
      { name: "Iloilo", cities: ["Iloilo City","Passi","Ajuy","Alimodian","Anilao","Badiangan","Balasan","Banate","Barotac Nuevo","Barotac Viejo","Batad","Bingawan","Cabatuan","Calinog","Carles","Concepcion","Dingle","Dueñas","Dumangas","Estancia","Guimbal","Igbaras","Janiuay","Lambunao","Leganes","Lemery","Leon","Maasin","Miagao","Mina","New Lucena","Oton","Pavia","Pototan","San Dionisio","San Enrique","San Joaquin","San Miguel","San Rafael","Santa Barbara","Sara","Tigbauan","Tubungan","Zarraga"] },
      { name: "Negros Occidental", cities: ["Bacolod","Bago","Cadiz","Escalante","Himamaylan","Kabankalan","La Carlota","Sagay","San Carlos","Silay","Sipalay","Talisay","Victorias","Binalbagan","Calatrava","Candoni","Cauayan","Enrique B. Magalona","Hinigaran","Hinoba-an","Ilog","Isabela","La Castellana","Manapla","Moises Padilla","Murcia","Pontevedra","Pulupandan","Salvador Benedicto","San Enrique","Toboso","Valladolid"] },
    ]
  },
  {
    name: "Region VII – Central Visayas",
    provinces: [
      { name: "Bohol", cities: ["Tagbilaran","Alburquerque","Alicia","Anda","Antequera","Baclayon","Balilihan","Batuan","Bien Unido","Bilar","Buenavista","Calape","Candijay","Carmen","Catigbian","Clarin","Corella","Cortes","Dagohoy","Danao","Dauis","Dimiao","Duero","Garcia Hernandez","Getafe","Guindulman","Inabanga","Jagna","Jetafe","Lila","Loay","Loboc","Loon","Mabini","Maribojoc","Panglao","Pilar","President Carlos P. Garcia","Sagbayan","San Isidro","San Miguel","Sevilla","Sierra Bullones","Sikatuna","Talibon","Trinidad","Tubigon","Ubay","Valencia"] },
      { name: "Cebu", cities: ["Cebu City","Mandaue","Lapu-Lapu","Toledo","Danao","Carcar","Talisay","Bogo","Naga","Alcantara","Alcoy","Alegria","Aloguinsan","Argao","Asturias","Badian","Balamban","Bantayan","Barili","Boljoon","Borbon","Carmen","Catmon","Compostela","Consolacion","Cordova","Daanbantayan","Dalaguete","Dumanjug","Ginatilan","Liloan","Madridejos","Malabuyoc","Medellin","Minglanilla","Moalboal","Oslob","Pilar","Pinamungajan","Poro","Ronda","Samboan","San Fernando","San Francisco","San Remigio","Santa Fe","Santander","Sibonga","Sogod","Tabogon","Tabuelan","Tuburan","Tudela"] },
      { name: "Negros Oriental", cities: ["Dumaguete","Bais","Bayawan","Canlaon","Guihulngan","Tanjay","Amlan","Ayungon","Bacong","Basay","Bindoy","Dauin","Jimalalud","La Libertad","Mabinay","Manjuyod","Pamplona","San Jose","Santa Catalina","Siaton","Sibulan","Tayasan","Valencia","Vallehermoso","Zamboanguita"] },
      { name: "Siquijor", cities: ["Siquijor","Enrique Villanueva","Larena","Lazi","Maria","San Juan"] },
    ]
  },
  {
    name: "Region VIII – Eastern Visayas",
    provinces: [
      { name: "Biliran", cities: ["Naval","Almeria","Biliran","Cabucgayan","Caibiran","Culaba","Kawayan","Maripipi"] },
      { name: "Eastern Samar", cities: ["Borongan","Arteche","Balangiga","Balangkayan","Can-avid","Dolores","General MacArthur","Giporlos","Guiuan","Hernani","Jipapad","Lawaan","Llorente","Maslog","Maydolong","Mercedes","Oras","Quinapondan","Salcedo","San Julian","San Policarpo","Sulat","Taft"] },
      { name: "Leyte", cities: ["Tacloban","Baybay","Ormoc","Alangalang","Albuera","Babatngon","Burauen","Calubian","Capoocan","Carigara","Dagami","Dulag","Hilongos","Hindang","Inopacan","Isabel","Jaro","Javier","Julita","Kananga","La Paz","Leyte","MacArthur","Mahaplag","Matag-ob","Matalom","Mayorga","Merida","Palo","Palompon","Pastrana","San Isidro","San Miguel","Santa Fe","Tabango","Tabontabon","Tanauan","Tolosa","Tunga","Villaba"] },
      { name: "Northern Samar", cities: ["Catarman","Allen","Biri","Bobon","Capul","Catubig","Gamay","Laoang","Lapinig","Las Navas","Lavezares","Lope de Vega","Mapanas","Mondragon","Palapag","Pambujan","Rosario","San Antonio","San Isidro","San Jose","San Roque","San Vicente","Silvino Lobos","Victoria"] },
      { name: "Samar", cities: ["Catbalogan","Basey","Calbayog","Calbiga","Daram","Gandara","Hinabangan","Jiabong","Marabut","Matuguinao","Motiong","Paranas","Pinabacdao","San Jorge","San Jose de Buan","San Sebastian","Santa Margarita","Santa Rita","Santo Niño","Tagapul-an","Talalora","Tarangnan","Villareal","Zumarraga"] },
      { name: "Southern Leyte", cities: ["Maasin","Anahawan","Bontoc","Hinunangan","Hinundayan","Libagon","Liloan","Limasawa","Macrohon","Malitbog","Padre Burgos","Pintuyan","Saint Bernard","San Francisco","San Juan","San Ricardo","Silago","Sogod","Tomas Oppus"] },
    ]
  },
  {
    name: "Region IX – Zamboanga Peninsula",
    provinces: [
      { name: "Zamboanga del Norte", cities: ["Dipolog","Dapitan","Baliguian","Godod","Gutalac","Jose Dalman","Kalawit","Katipunan","La Libertad","Labason","Liloy","Manukan","Mutia","Piñan","Polanco","President Manuel A. Roxas","Rizal","Salug","San Miguel","San Pablo","Sergio Osmeña Sr.","Siayan","Sibuco","Sibutad","Sindangan","Siocon","Sirawai","Tampilisan"] },
      { name: "Zamboanga del Sur", cities: ["Pagadian","Zamboanga City","Aurora","Bayog","Dimataling","Dinas","Dumalinao","Dumingag","Guipos","Josefina","Kumalarang","Labangan","Lakewood","Lapuyan","Mahayag","Margosatubig","Midsalip","Molave","Ramon Magsaysay","San Miguel","San Pablo","Tabina","Tambulig","Tigbao","Tukuran","Vincenzo A. Sagun"] },
      { name: "Zamboanga Sibugay", cities: ["Ipil","Alicia","Buug","Diplahan","Imelda","Kabasalan","Mabuhay","Malangas","Naga","Olutanga","Payao","Roseller T. Lim","Siay","Talusan","Titay","Tungawan"] },
    ]
  },
  {
    name: "Region X – Northern Mindanao",
    provinces: [
      { name: "Bukidnon", cities: ["Malaybalay","Valencia","Baungon","Cabanglasan","Damulog","Dangcagan","Don Carlos","Impasug-ong","Kadingilan","Kalilangan","Kibawe","Kitaotao","Lantapan","Libona","Malitbog","Manolo Fortich","Maramag","Pangantucan","Quezon","San Fernando","Sumilao","Talakag"] },
      { name: "Camiguin", cities: ["Mambajao","Catarman","Guinsiliban","Mahinog","Sagay"] },
      { name: "Lanao del Norte", cities: ["Iligan","Bacolod","Baloi","Baroy","Kapatagan","Kauswagan","Kolambugan","Lala","Linamon","Magsaysay","Maigo","Munai","Nunungan","Pantao Ragat","Pantar","Poona Piagapo","Salvador","Sapad","Sultan Naga Dimaporo","Tagoloan","Tangkal","Tubod"] },
      { name: "Misamis Occidental", cities: ["Oroquieta","Ozamiz","Tangub","Aloran","Baliangao","Bonifacio","Calamba","Clarin","Concepcion","Don Victoriano Chiongbian","Jimenez","Lopez Jaena","Panaon","Plaridel","Sapang Dalaga","Sinacaban","Tudela"] },
      { name: "Misamis Oriental", cities: ["Cagayan de Oro","Gingoog","Alubijid","Balingasag","Balingoan","Binuangan","Claveria","El Salvador","Gitagum","Initao","Jasaan","Kinoguitan","Lagonglong","Laguindingan","Libertad","Lugait","Magsaysay","Manticao","Medina","Naawan","Opol","Salay","Sugbongcogon","Tagoloan","Talisayan","Villanueva"] },
    ]
  },
  {
    name: "Region XI – Davao Region",
    provinces: [
      { name: "Davao de Oro", cities: ["Nabunturan","Compostela","Laak","Mabini","Maco","Maragusan","Mawab","Monkayo","Montevista","New Bataan","Pantukan"] },
      { name: "Davao del Norte", cities: ["Tagum","Panabo","Samal","Asuncion","Braulio E. Dujali","Carmen","Kapalong","New Corella","San Isidro","Santo Tomas","Talaingod"] },
      { name: "Davao del Sur", cities: ["Digos","Bansalan","Don Marcelino","Hagonoy","Jose Abad Santos","Kiblawan","Magsaysay","Malalag","Matanao","Padada","Santa Cruz","Sulop"] },
      { name: "Davao Occidental", cities: ["Malita","Don Marcelino","Jose Abad Santos","Sarangani","Santa Maria"] },
      { name: "Davao Oriental", cities: ["Mati","Baganga","Banaybanay","Boston","Caraga","Cateel","Governor Generoso","Lupon","Manay","San Isidro","Tarragona"] },
    ]
  },
  {
    name: "Region XII – SOCCSKSARGEN",
    provinces: [
      { name: "Cotabato", cities: ["Kidapawan","Alamada","Aleosan","Antipas","Arakan","Banisilan","Carmen","Kabacan","Libungan","Magpet","Makilala","Matalam","Midsayap","Mlang","Pigkawayan","Pikit","President Roxas","Tulunan"] },
      { name: "Sarangani", cities: ["Alabel","Glan","Kiamba","Maasim","Maitum","Malapatan","Malungon"] },
      { name: "South Cotabato", cities: ["Koronadal","General Santos","Banga","Lake Sebu","Norala","Polomolok","Santo Niño","Surallah","T'boli","Tampakan","Tantangan","Tupi"] },
      { name: "Sultan Kudarat", cities: ["Isulan","Tacurong","Bagumbayan","Columbio","Esperanza","Kalamansig","Lambayong","Lebak","Lutayan","Palimbang","President Quirino","Senator Ninoy Aquino"] },
    ]
  },
  {
    name: "Region XIII – Caraga",
    provinces: [
      { name: "Agusan del Norte", cities: ["Butuan","Cabadbaran","Buenavista","Carmen","Jabonga","Kitcharao","Las Nieves","Magallanes","Nasipit","Remedios T. Romualdez","Santiago","Tubay"] },
      { name: "Agusan del Sur", cities: ["Prosperidad","Bayugan","Bunawan","Esperanza","La Paz","Loreto","Rosario","San Francisco","San Luis","Santa Josefa","Sibagat","Talacogon","Trento","Veruela"] },
      { name: "Dinagat Islands", cities: ["San Jose","Basilisa","Cagdianao","Dinagat","Libjo","Loreto","Tubajon"] },
      { name: "Surigao del Norte", cities: ["Surigao City","Alegria","Bacuag","Burgos","Claver","Dapa","Del Carmen","General Luna","Gigaquit","Mainit","Malimono","Pilar","Placer","San Benito","San Francisco","San Isidro","Santa Monica","Sison","Socorro","Tagana-an","Tubod"] },
      { name: "Surigao del Sur", cities: ["Tandag","Bislig","Barobo","Bayabas","Cagwait","Cantilan","Carmen","Carrascal","Cortes","Hinatuan","Lanuza","Lianga","Lingig","Madrid","Marihatag","San Agustin","San Miguel","Tago","Tagbina"] },
    ]
  },
  {
    name: "CAR – Cordillera Administrative Region",
    provinces: [
      { name: "Abra", cities: ["Bangued","Boliney","Bucay","Bucloc","Daguioman","Danglas","Dolores","La Paz","Lacub","Lagayan","Langiden","Licuan-Baay","Luba","Malibcong","Manabo","Peñarrubia","Pidigan","Pilar","Sallapadan","San Isidro","San Juan","San Quintin","Tayum","Tineg","Tubo","Villaviciosa"] },
      { name: "Apayao", cities: ["Calanasan","Conner","Flora","Kabugao","Luna","Pudtol","Santa Marcela"] },
      { name: "Benguet", cities: ["La Trinidad","Baguio","Atok","Bakun","Bokod","Buguias","Itogon","Kabayan","Kapangan","Kibungan","La Trinidad","Mankayan","Sablan","Tuba","Tublay"] },
      { name: "Ifugao", cities: ["Lagawe","Alfonso Lista","Aguinaldo","Asipulo","Banaue","Hingyon","Hungduan","Kiangan","Lamut","Mayoyao","Tinoc"] },
      { name: "Kalinga", cities: ["Tabuk","Balbalan","Lubuagan","Pasil","Pinukpuk","Rizal","Tanudan","Tinglayan"] },
      { name: "Mountain Province", cities: ["Bontoc","Bauko","Besao","Natonin","Paracelis","Sabangan","Sadanga","Tadian"] },
    ]
  },
  {
    name: "NCR – National Capital Region",
    provinces: [
      { name: "Metro Manila", cities: ["Manila","Quezon City","Caloocan","Las Piñas","Makati","Malabon","Mandaluyong","Marikina","Muntinlupa","Navotas","Parañaque","Pasay","Pasig","Pateros","San Juan","Taguig","Valenzuela"] },
    ]
  },
  {
    name: "BARMM – Bangsamoro Autonomous Region",
    provinces: [
      { name: "Basilan", cities: ["Isabela City","Akbar","Al-Barka","Hadji Mohammad Ajul","Hadji Muhtamad","Lamitan","Lantawan","Maluso","Sumisip","Tabuan-Lasa","Tipo-Tipo","Tuburan","Ungkaya Pukan"] },
      { name: "Lanao del Sur", cities: ["Marawi","Bacolod-Kalawi","Balabagan","Balindong","Bayang","Binidayan","Buadiposo-Buntong","Bubong","Bumbaran","Butig","Calanogas","Ditsaan-Ramain","Ganassi","Kapai","Kapatagan","Lumba-Bayabao","Lumbac","Lumbatan","Lumbayanague","Madalum","Madamba","Maguing","Malabang","Marantao","Marogong","Masiu","Mulondo","Pagayawan","Piagapo","Poona Bayabao","Pualas","Saguiaran","Sultan Dumalondong","Tagoloan II","Tamparan","Taraka","Tubaran","Tugaya","Wao"] },
      { name: "Maguindanao del Norte", cities: ["Datu Odin Sinsuat","Barira","Buldon","Datu Blah T. Sinsuat","Datu Paglas","Dinaig","Kabuntalan","Matanog","Northern Kabuntalan","Parang","Sultan Mastura","Sultan Sa Barongis","Upi"] },
      { name: "Maguindanao del Sur", cities: ["Buluan","Datu Abdullah Sangki","Datu Anggal Midtimbang","Datu Hoffer Ampatuan","Datu Piang","Datu Salibo","Datu Saudi-Ampatuan","Datu Unsay","Gen. Salipada K. Pendatun","Guindulungan","Mamasapano","Mangudadatu","Pagalungan","Paglat","Pandag","Rajah Buayan","Shariff Aguak","Shariff Saydona Mustapha","South Upi","Sultan Kudarat","Sultan sa Barongis","Talayan","Talitay"] },
      { name: "Sulu", cities: ["Jolo","Hadji Panglima Tahil","Indanan","Kalingalan Caluang","Lugus","Luuk","Maimbung","Old Panamao","Omar","Pandami","Panglima Estino","Pangutaran","Parang","Pata","Patikul","Siasi","Talipao","Tapul","Tongkil"] },
      { name: "Tawi-Tawi", cities: ["Bongao","Languyan","Mapun","Panglima Sugala","Sapa-Sapa","Sibutu","Simunul","Sitangkai","South Ubian","Tandubas","Turtle Islands"] },
    ]
  },
];


// ─── INDUSTRIES ───────────────────────────────────────────────────────────────
const INDUSTRIES = [
  "Agriculture",
  "Computer and Technology",
  "Education",
  "Finance and Economics",
  "Health Care",
  "Hospitality",
  "Manufacturing",
  "Media and News",
  "Pharmaceutical",
  "Telecommunications",
  "Transportation",
];

// ─── ALL COMPANIES (kept for legacy import compatibility — use useOjtPosts hook instead) ──
export const ALL_COMPANIES = [];

// ─── HOOK: fetch live OJT posts from Firestore ────────────────────────────────
export const useOjtPosts = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = query(collection(db, "ojt_posts"), where("disabled", "==", false));
    const unsub = onSnapshot(q, snap => {
      const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      loaded.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPosts(loaded);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);
  return { posts, loading };
};

// ─── REPORT CATEGORIES ────────────────────────────────────────────────────────
const reportCategories = [
  { label: "Fraud and Scam", description: "Job scams are fraudulent schemes where scammers impersonate employers to steal money, personal information, or coerce victims into fake work activities.", details: ["Fake job postings requiring payment","Identity theft","Misrepresentation of company"] },
  { label: "Discrimination", description: "Discrimination in the workplace involves unfair treatment of individuals based on race, gender, age, religion, disability, or other protected characteristics.", details: ["Racial discrimination","Gender-based bias","Age discrimination","Religious intolerance"] },
  { label: "Sexual Harassment", description: "Sexual harassment includes any unwelcome sexual advances, requests for sexual favors, or other verbal or physical conduct of a sexual nature in the workplace.", details: ["Unwanted physical contact","Verbal harassment","Hostile work environment","Quid pro quo harassment"] },
  { label: "Harmful Misinformation", description: "Spreading false information about OJT programs, company practices, or student requirements that can mislead or harm students.", details: ["False program descriptions","Fake requirements","Misleading slot information"] },
  { label: "Workplace Misconduct", description: "Workplace misconduct refers to behavior that violates company policies or professional standards, including unsafe working conditions.", details: ["Unsafe working conditions","Violation of OJT agreement","Forced overtime","Unpaid work"] },
  { label: "Others", description: "Any other concern not listed above. Please provide a detailed description of the issue.", details: [] },
];

// ── Responsive styles injected once ──────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Jersey+25&family=Jua&family=Kufam:wght@400;600;700&family=Monomaniac+One&display=swap');

    /* Company grid: 2-col ≥768px, 1-col below */
    .stud-company-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    @media (max-width: 767px) {
      .stud-company-grid { grid-template-columns: 1fr; }
    }

    /* Search bar input shrinks on mobile */
    .stud-search-input {
      width: 160px;
    }
    @media (max-width: 480px) {
      .stud-search-input { width: 110px; }
    }

    /* Profile content padding */
    .stud-profile-content {
      padding: 28px 32px 100px;
    }
    @media (max-width: 640px) {
      .stud-profile-content { padding: 16px 16px 100px; }
    }

    /* Profile top row: side-by-side on desktop, stacked on mobile */
    .stud-profile-top {
      display: flex;
      gap: 24px;
      margin-bottom: 20px;
    }
    @media (max-width: 640px) {
      .stud-profile-top { flex-direction: column; }
    }

    /* Map placeholder: fixed width on desktop, full width on mobile */
    .stud-map-box {
      width: 180px;
      flex-shrink: 0;
    }
    @media (max-width: 640px) {
      .stud-map-box { width: 100%; min-height: 100px; }
    }

    /* Profile bottom bar padding */
    .stud-profile-bar {
      padding: 14px 32px;
    }
    @media (max-width: 640px) {
      .stud-profile-bar { padding: 12px 16px; }
    }

    /* Action buttons in bottom bar: wrap on very small screens */
    .stud-action-buttons {
      display: flex;
      gap: 12px;
    }
    @media (max-width: 400px) {
      .stud-action-buttons { flex-direction: column; gap: 8px; }
    }

    /* Search + filter bar */
    .stud-search-bar {
      padding: 16px 20px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }
    @media (max-width: 480px) {
      .stud-search-bar { padding: 12px 14px; }
    }

    /* List wrapper: vertical scroll only */
    .stud-list-wrapper {
      overflow-x: hidden;
      width: 100%;
    }

    /* Report modal: full-width on mobile */
    .stud-report-modal-inner {
      background: white;
      border-radius: 16px;
      width: 100%;
      max-width: 520px;
      max-height: 85vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* Company card: prevent location overflow */
    .stud-card-location {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `}</style>
);

// ─── REPORT MODAL ─────────────────────────────────────────────────────────────
const ReportModal = ({ company, onClose, onSubmit }) => {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState(null);
  const [description, setDescription] = useState("");
  const [attachedFile, setAttachedFile] = useState(null);
  const fileRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!["image/png","application/pdf"].includes(file.type)) { alert("Only PNG and PDF files are allowed."); return; }
    setAttachedFile({ name: file.name, type: file.type, url: URL.createObjectURL(file) });
  };

  const handleSubmit = () => {
    if (!description.trim()) { alert("Please write a description."); return; }
    onSubmit({ company: company.companyName || company.name, concern: selected?.label || "Others", date: new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}), description, attachedFile });
    onClose();
  };

  const cat = reportCategories.find(c => c.label === selected?.label);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <div className="stud-report-modal-inner">
        <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #eee" }}>
          <span style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "1.5rem", color: darkRed }}>Reports:</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "#555" }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {step === 1 && (
            <>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.95rem", marginBottom: "14px" }}>Please select:</p>
              {reportCategories.map((cat) => (
                <div key={cat.label} onClick={() => setSelected(cat)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}>
                  <div style={{ width: "22px", height: "22px", borderRadius: "50%", border: `2px solid ${red}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: selected?.label === cat.label ? red : "white" }}>
                    {selected?.label === cat.label && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "white" }} />}
                  </div>
                  <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.93rem", color: "#222" }}>{cat.label}</span>
                </div>
              ))}
            </>
          )}
          {step === 2 && cat && (
            <>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "1rem", marginBottom: "6px" }}>{cat.label}</p>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#666", marginBottom: "12px" }}>More about this reason:</p>
              <hr style={{ borderColor: "#eee", marginBottom: "14px" }} />
              <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.85rem", color: "#444", lineHeight: 1.7, marginBottom: "14px" }}>{cat.description}</p>
              {cat.details.length > 0 && (<><p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.88rem", marginBottom: "8px" }}>Common Types:</p><ul style={{ paddingLeft: "18px" }}>{cat.details.map((d, i) => <li key={i} style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.83rem", color: "#555", marginBottom: "4px" }}>{d}</li>)}</ul></>)}
            </>
          )}
          {step === 3 && (
            <>
              <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.95rem", marginBottom: "10px" }}>Write a description:</p>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the issue..."
                style={{
                  width: "100%", minHeight: "100px",
                  border: "none", borderBottom: `2px solid ${red}`,
                  outline: "none", fontFamily: "'Kufam', sans-serif",
                  fontSize: "0.88rem", resize: "none",
                  background: "transparent", color: "#222", marginBottom: "20px",
                  overflowY: "auto",
                  scrollbarWidth: "thin",
                  scrollbarColor: `${darkRed} transparent`,
                  boxSizing: "border-box",
                }}
              />
              <p style={{ fontFamily: "'Kufam', sans-serif", fontWeight: 700, fontSize: "0.95rem", marginBottom: "10px" }}>Attach File:</p>
              <input ref={fileRef} type="file" accept=".png,.pdf" style={{ display: "none" }} onChange={handleFile} />
              {!attachedFile ? (
                <div onClick={() => fileRef.current.click()} style={{ width: "80px", height: "80px", background: "#e8c8c8", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#f5f5f5", padding: "10px 14px", borderRadius: "8px" }}>
                  {attachedFile.type.startsWith("image/") ? <img src={attachedFile.url} alt="preview" style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "6px" }} /> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                  <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#555" }}>{attachedFile.name}</span>
                  <button onClick={() => setAttachedFile(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: "1rem" }}>✕</button>
                </div>
              )}
            </>
          )}
        </div>
        <div style={{ background: darkRed, padding: "12px 20px", display: "flex", justifyContent: "flex-end" }}>
          {step < 3 ? (
            <button onClick={() => { if (step === 1 && !selected) { alert("Please select a concern."); return; } setStep(step + 1); }} style={{ padding: "8px 20px", borderRadius: "20px", background: "rgba(255,255,255,0.2)", color: "white", border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem" }}>Next {step}/3</button>
          ) : (
            <button onClick={handleSubmit} style={{ padding: "8px 20px", borderRadius: "20px", background: "rgba(255,255,255,0.2)", color: "white", border: "none", fontFamily: "'Kufam', sans-serif", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem" }}>Submit report</button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── COMPANY PROFILE ──────────────────────────────────────────────────────────
const CompanyProfile = ({ company, onBack, onReport, onMessageNow, onApplyNow }) => {
  const _s = company?.slots || "0/0";
  const isFull = _s.split("/")[0] === _s.split("/")[1];
  const loc = company.location || {};
  const locationLines = [
    loc.region   ? `Region: ${loc.region}`          : null,
    loc.province ? `Province: ${loc.province}`      : null,
    loc.city     ? `City/Municipality: ${loc.city}` : null,
    loc.barangay ? `Barangay: ${loc.barangay}`      : null,
    loc.street   ? `Street/Building: ${loc.street}` : null,
  ].filter(Boolean);

  const locationParts = [loc.street, loc.barangay, loc.city, loc.province, loc.region].filter(Boolean);
  const fullLocation = loc.fullAddress || locationParts.join(", ");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f5f5f5", overflow: "hidden", position: "relative" }}>
      <div className="stud-profile-content" style={{ flex: 1, overflowY: "auto" }}>

        {/* Top row: description + map */}
        <div className="stud-profile-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
              <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Monomaniac One', sans-serif", fontSize: "3rem", color: "#1a1a1a", lineHeight: 1, padding: 0, flexShrink: 0 }}>←</button>
              <h1 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.4rem, 4vw, 2.2rem)", color: "#111" }}>{company.companyName || company.name}</h1>
            </div>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.8rem, 2vw, 0.88rem)", color: "#444", lineHeight: 1.7 }}>{company.description}</p>
          </div>
          <div className="stud-map-box" style={{ borderRadius: "14px", overflow: "hidden", minHeight: "130px" }}>
            <MapboxStaticView
              lat={company.postLocation?.lat}
              lng={company.postLocation?.lng}
              address={company.postLocation?.address || fullLocation}
            />
          </div>
        </div>

        <hr style={{ borderColor: "#ddd", marginBottom: "20px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.2rem, 3vw, 1.5rem)", color: "#111", marginBottom: "8px" }}>Requirements</h2>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.8rem, 2vw, 0.87rem)", color: "#444", whiteSpace: "pre-line" }}>{Array.isArray(company.requirements) ? company.requirements.join("\n") : (company.requirements || "N/A")}</p>
          </div>
          <div>
            <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "1rem", fontWeight: 700, color: "#111" }}>Slot: </span>
            <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "1rem", fontWeight: 700, color: isFull ? red : "#2a7a2a" }}>{company.slot}</span>
          </div>
        </div>

        <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.2rem, 3vw, 1.5rem)", color: "#111", marginBottom: "8px" }}>Working Hours</h2>
        <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.8rem, 2vw, 0.87rem)", color: "#444", marginBottom: "20px", whiteSpace: "pre-line" }}>{company.workingHours}</p>

        <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.2rem, 3vw, 1.5rem)", color: "#111", marginBottom: "8px" }}>Contact Information</h2>
        <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.8rem, 2vw, 0.87rem)", color: "#444", marginBottom: "4px" }}>Phone Number: {company.phone || company.contact?.phone || "N/A"}</p>
        <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.8rem, 2vw, 0.87rem)", color: "#444", marginBottom: "20px" }}>Email: {company.contactEmail || company.contact?.email || company.email || "N/A"}</p>

        <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.2rem, 3vw, 1.5rem)", color: "#111", marginBottom: "8px" }}>Location</h2>
        <div style={{ marginBottom: "20px" }}>
          {company.postLocation?.address ? (
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.8rem, 2vw, 0.87rem)", color: "#444" }}>{company.postLocation.address}</p>
          ) : (
            locationLines.map((line, i) => <p key={i} style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.8rem, 2vw, 0.87rem)", color: "#444", marginBottom: "3px" }}>{line}</p>)
          )}
        </div>

        <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.2rem, 3vw, 1.5rem)", color: "#111", marginBottom: "8px" }}>Benefits</h2>
        <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.8rem, 2vw, 0.87rem)", color: "#444", whiteSpace: "pre-line", marginBottom: "20px" }}>{Array.isArray(company.benefits) ? company.benefits.join("\n") : (company.benefits || "N/A")}</p>

        <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.2rem, 3vw, 1.5rem)", color: "#111", marginBottom: "10px" }}>Course / Program:</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
          {(Array.isArray(company.courseSelections) ? company.courseSelections : []).map((cp, i) => {
            const label = [cp.college, cp.program, cp.specialization].filter(Boolean).join(" – ");
            return <span key={i} style={{ padding: "4px 14px", borderRadius: "20px", background: "#e0f0e0", color: "#2a7a2a", fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", fontWeight: 600 }}>{label}</span>;
          })}
        </div>

        <h2 style={{ fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(1.2rem, 3vw, 1.5rem)", color: "#111", marginBottom: "10px" }}>Skills Required</h2>
        <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "clamp(0.8rem, 2vw, 0.87rem)", color: "#444", whiteSpace: "pre-line" }}>{Array.isArray(company.skillsRequired) ? company.skillsRequired.join("\n") : (company.skillsRequired || company.skills?.join(", ") || "N/A")}</p>
      </div>

      {/* Bottom action bar */}
      <div className="stud-profile-bar" style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "white", borderTop: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="stud-action-buttons">
          <button onClick={onApplyNow} style={{ background: darkRed, color: "white", border: "none", borderRadius: "24px", padding: "12px 28px", fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)", cursor: "pointer" }}>Apply Now!</button>
          <button onClick={onMessageNow} style={{ background: darkRed, color: "white", border: "none", borderRadius: "24px", padding: "12px 28px", fontFamily: "'Jersey 25', sans-serif", fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)", cursor: "pointer" }}>Message Now!</button>
        </div>
        <div onClick={onReport} style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
          <img src={reportIcon} alt="Report" style={{ width: "44px", height: "44px", objectFit: "contain" }} />
          <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.72rem", color: darkRed, fontWeight: 600 }}>Report!</span>
        </div>
      </div>
    </div>
  );
};

// ─── FILTER PANEL ─────────────────────────────────────────────────────────────
const FilterPanel = ({ selectedIndustries, setSelectedIndustries, citySearch, setCitySearch }) => {
  const toggleIndustry = (ind) =>
    setSelectedIndustries(prev =>
      prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]
    );
  const clearAll = () => { setSelectedIndustries([]); setCitySearch(""); };

  return (
    <div style={{ position: "absolute", top: "48px", right: 0, width: "240px", background: "white", border: `1.5px solid ${red}`, borderRadius: "10px", boxShadow: "0 6px 24px rgba(0,0,0,0.18)", zIndex: 100, overflow: "hidden", fontFamily: "'Kufam', sans-serif" }}>
      <div style={{ padding: "10px 12px 4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <p style={{ fontSize: "0.78rem", fontWeight: "bold", color: darkRed, margin: 0 }}>Industry:</p>
          <button onClick={clearAll} style={{ background: "none", border: "none", fontSize: "0.7rem", color: red, cursor: "pointer", fontFamily: "'Kufam', sans-serif", padding: 0, textDecoration: "underline" }}>Clear all</button>
        </div>
        <div style={{ maxHeight: "130px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "5px" }}>
          {INDUSTRIES.map(ind => (
            <span key={ind} onClick={() => toggleIndustry(ind)} style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "0.72rem", cursor: "pointer", userSelect: "none", background: selectedIndustries.includes(ind) ? red : "#f0e0e0", color: selectedIndustries.includes(ind) ? "white" : darkRed, border: `1px solid ${red}`, transition: "all 0.15s" }}>{ind}</span>
          ))}
        </div>
      </div>
      <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "6px 0" }} />
      <div style={{ padding: "4px 12px 10px" }}>
        <p style={{ fontSize: "0.78rem", fontWeight: "bold", color: darkRed, marginBottom: "6px" }}>Location (City):</p>
        <input
          type="text"
          value={citySearch}
          onChange={e => setCitySearch(e.target.value)}
          placeholder="e.g. Angeles, Tarlac..."
          style={{ width: "100%", padding: "6px 10px", borderRadius: "8px", border: `1px solid ${red}`, fontSize: "0.76rem", fontFamily: "'Kufam', sans-serif", outline: "none", boxSizing: "border-box", color: darkRed }}
        />
      </div>
    </div>
  );
};

// ─── COMPANY CARD ─────────────────────────────────────────────────────────────
const CompanyCard = ({ company, onViewProfile }) => {
  // Support both old static shape ({ slots: "0/10" }) and Firestore shape ({ slot: 10 })
  const isActive = company.disabled === false || company.active !== false;
  const displayName = company.companyName || company.name || "Unnamed Company";
  const displayIndustry = company.industry || "—";
  const displayLocation = typeof company.location === "object"
    ? [company.location?.city, company.location?.province].filter(Boolean).join(", ")
    : (company.location || "—");
  const _slots = company?.slots || "0/0";
  const totalSlots = company?.slot ?? (typeof _slots === "string" ? parseInt(_slots.split("/")[1]) : 0) ?? 0;
  const usedSlots  = typeof _slots === "string" ? parseInt(_slots.split("/")[0]) : 0;
  const isFull = usedSlots >= totalSlots && totalSlots > 0;
  const postedDate = company.createdAt?.seconds
    ? new Date(company.createdAt.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : (company.posted || "");

  return (
    <div
      onClick={() => isActive && onViewProfile(company)}
      style={{ background: isActive ? "white" : "#f0f0f0", borderRadius: "14px", border: `1.5px solid ${isActive ? "#ddd" : "#ccc"}`, padding: "18px 20px", display: "flex", flexDirection: "column", gap: "6px", boxShadow: isActive ? "0 2px 10px rgba(0,0,0,0.08)" : "none", opacity: isActive ? 1 : 0.7, transition: "box-shadow 0.2s, transform 0.2s", cursor: isActive ? "pointer" : "default", position: "relative", minWidth: 0, overflow: "hidden" }}
      onMouseEnter={e => { if (isActive) { e.currentTarget.style.boxShadow = "0 6px 20px rgba(139,0,0,0.15)"; e.currentTarget.style.transform = "translateY(-2px)"; } }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = isActive ? "0 2px 10px rgba(0,0,0,0.08)" : "none"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ position: "absolute", top: "14px", right: "14px", background: isFull ? "#e0e0e0" : "#fff0f0", border: `1px solid ${isFull ? "#bbb" : red}`, borderRadius: "20px", padding: "2px 8px", fontSize: "0.68rem", color: isFull ? "#888" : red, fontFamily: "'Kufam', sans-serif", fontWeight: "bold" }}>
        {isFull ? "Full" : `${totalSlots} slot${totalSlots !== 1 ? "s" : ""}`}
      </div>
      <h3 style={{ fontFamily: "'Jua', sans-serif", fontSize: isActive ? "1.05rem" : "0.95rem", color: isActive ? "#1a1a1a" : "#555", paddingRight: "60px", lineHeight: 1.3 }}>{displayName}</h3>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: "#555" }}>Industry: {displayIndustry}</p>
      <p className="stud-card-location" style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: "#555" }}>Location: {displayLocation}, Philippines</p>
      <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: "#555" }}>Slots Available: {totalSlots}</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
        <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.75rem", color: "#999", fontStyle: "italic" }}>{postedDate ? `Posted ${postedDate}` : ""}</span>
        <span onClick={() => isActive && onViewProfile(company)} style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.8rem", color: isActive ? red : "#aaa", fontWeight: "bold", cursor: isActive ? "pointer" : "default", display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>View Profile<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>
      </div>
    </div>
  );
};

// ─── MAIN FIND COMPANY SCREEN ─────────────────────────────────────────────────
const StudentFindCompanyScreen = ({ onReportSubmit, onNavigateToReports, onMessageNow, onApplyNow, initialCompanyId, onClearInitialCompany, user, onVisitCompany }) => {
  const { posts: companies, loading } = useOjtPosts();
  const [view, setView] = useState("list");
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [selectedIndustries, setSelectedIndustries] = useState([]);
  const [citySearch, setCitySearch] = useState("");
  const [showApplyModal, setShowApplyModal] = useState(false);
  const filterRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (initialCompanyId && companies.length > 0) {
      const company = companies.find(c => c.id === initialCompanyId);
      if (company) { setSelectedCompany(company); setView("profile"); onVisitCompany?.({ id: company.id, name: company.companyName || company.name }); }
      onClearInitialCompany?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCompanyId, companies]);

  const hasFilter = selectedIndustries.length > 0 || citySearch.trim();

  const filtered = companies.filter(c => {
    const name = (c.company || c.name || "").toLowerCase();
    const industry = (c.industry || "").toLowerCase();
    const loc = (c.location?.city || c.location || "").toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || industry.includes(search.toLowerCase()) || loc.includes(search.toLowerCase());
    const matchIndustry = selectedIndustries.length === 0 || selectedIndustries.includes(c.industry);
    const matchCity = !citySearch.trim() || loc.includes(citySearch.trim().toLowerCase()) || (c.postLocation?.address || "").toLowerCase().includes(citySearch.trim().toLowerCase());
    return matchSearch && matchIndustry && matchCity;
  });

  const activeBadgeLabel = () => citySearch.trim() ? `City: ${citySearch.trim()}` : null;
  const clearAllFilters = () => { setSelectedIndustries([]); setCitySearch(""); };

  const handleReportSubmit = (report) => { onReportSubmit?.(report); setShowReportModal(false); setView("list"); onNavigateToReports?.(); };

  if (view === "profile" && selectedCompany) {
    return (
      <>
        <ResponsiveStyles />
        <CompanyProfile
          company={selectedCompany}
          onBack={() => setView("list")}
          onReport={() => setShowReportModal(true)}
          onMessageNow={() => onMessageNow?.({ ...selectedCompany, fromMessageNow: true })}
          onApplyNow={() => setShowApplyModal(true)}
        />
        {showReportModal && <ReportModal company={selectedCompany} onClose={() => setShowReportModal(false)} onSubmit={handleReportSubmit} />}
        {showApplyModal && (
          <ApplyModal
            company={selectedCompany}
            user={user}
            onClose={() => setShowApplyModal(false)}
            onSubmit={() => {
              // ApplyModal already handles the full Firestore submission (incl. file
              // uploads) internally and shows its own success popup. This callback is
              // just a notification hook — do NOT close the modal here, or the success
              // popup will be unmounted before the student can see/dismiss it.
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <ResponsiveStyles />
      {/* Outer: vertical scroll only, no horizontal overflow */}
      <div className="stud-list-wrapper" style={{ padding: "clamp(16px, 4vw, 28px) clamp(16px, 4vw, 32px)", overflowY: "auto", flex: 1, background: "#f5f5f5" }}>

        {/* Search + Filter bar */}
        <div className="stud-search-bar" style={{ background: darkRed, borderRadius: "14px" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "white", borderRadius: "24px", padding: "7px 16px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <div style={{ width: "2px", height: "16px", background: "rgba(0,0,0,0.3)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search Companies"
                className="stud-search-input"
                style={{ border: "none", background: "transparent", outline: "none", color: "black", fontFamily: "'Jersey 25', sans-serif", fontSize: "1.1rem" }}
              />
              {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "1rem", padding: "0", lineHeight: 1 }}>✕</button>}
            </div>
            <div ref={filterRef} style={{ position: "relative", marginLeft: "10px" }}>
              <div onClick={() => setShowFilter(v => !v)} style={{ width: "38px", height: "38px", background: "white", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: hasFilter ? `2px solid ${red}` : "none", position: "relative" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={hasFilter ? red : "#555"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                {hasFilter && <div style={{ position: "absolute", top: "-4px", right: "-4px", width: "10px", height: "10px", borderRadius: "50%", background: red }} />}
              </div>
              {showFilter && (
                <FilterPanel
                  selectedIndustries={selectedIndustries} setSelectedIndustries={setSelectedIndustries}
                  citySearch={citySearch} setCitySearch={setCitySearch}
                />
              )}
            </div>
          </div>
        </div>

        {/* Active filter badges */}
        {hasFilter && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.78rem", color: "#888" }}>Filters:</span>
            {selectedIndustries.map(ind => (
              <span key={ind} style={{ background: "#f0e0e0", color: darkRed, border: `1px solid ${red}`, borderRadius: "20px", padding: "2px 10px", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", display: "flex", alignItems: "center", gap: "5px" }}>
                {ind}<span onClick={() => setSelectedIndustries(p => p.filter(i => i !== ind))} style={{ cursor: "pointer", fontWeight: "bold" }}>×</span>
              </span>
            ))}
            {activeBadgeLabel() && (
              <span style={{ background: "#f0e0e0", color: darkRed, border: `1px solid ${red}`, borderRadius: "20px", padding: "2px 10px", fontSize: "0.74rem", fontFamily: "'Kufam', sans-serif", display: "flex", alignItems: "center", gap: "5px" }}>
                {activeBadgeLabel()}
                <span onClick={() => setCitySearch("")} style={{ cursor: "pointer", fontWeight: "bold" }}>×</span>
              </span>
            )}
            <span onClick={clearAllFilters} style={{ fontSize: "0.74rem", color: red, cursor: "pointer", fontFamily: "'Kufam', sans-serif", textDecoration: "underline" }}>Clear all</span>
          </div>
        )}

        {!loading && <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.82rem", color: "#888", marginBottom: "14px" }}>Showing {filtered.length} compan{filtered.length !== 1 ? "ies" : "y"}</p>}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: "12px" }}>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem", color: "#aaa" }}>Loading companies…</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="stud-company-grid">
            {filtered.map(c => (
              <CompanyCard key={c.id} company={c} onViewProfile={(company) => { setSelectedCompany(company); setView("profile"); onVisitCompany?.({ id: company.id, name: company.companyName || company.name }); }} />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: "12px" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <p style={{ fontFamily: "'Jua', sans-serif", fontSize: "1.5rem", color: "#bbb" }}>No companies found</p>
            <p style={{ fontFamily: "'Kufam', sans-serif", fontSize: "0.95rem", color: "#aaa" }}>No company data available yet</p>
          </div>
        )}
      </div>
    </>
  );
};

export default StudentFindCompanyScreen;