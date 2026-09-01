export interface DistrictDetails {
  lat: number;
  lng: number;
  talukas: string[];
}

export interface StateDetails {
  lat: number;
  lng: number;
  zoom: number;
  districts: Record<string, DistrictDetails>;
}

export const INDIA_LOCATION_DATA: Record<string, StateDetails> = {
  "Tamil Nadu": {
    lat: 11.1271,
    lng: 78.6569,
    zoom: 7,
    districts: {
      "Ariyalur": { lat: 11.1401, lng: 79.0782, talukas: ["Ariyalur", "Udayarpalayam", "Sendurai", "Andimadam"] },
      "Chengalpattu": { lat: 12.6819, lng: 79.9888, talukas: ["Chengalpattu", "Kanchipuram", "Madhuranthakam", "Tambaram", "Tiruporur"] },
      "Chennai": { lat: 13.0827, lng: 80.2707, talukas: ["Egmore", "Guindy", "Mylapore", "Tondiarpet", "Velachery"] },
      "Coimbatore": { lat: 11.0168, lng: 76.9558, talukas: ["Coimbatore North", "Coimbatore South", "Pollachi", "Mettupalayam", "Sulur", "Annur", "Kinathukadavu", "Valparai"] },
      "Cuddalore": { lat: 11.7480, lng: 79.7714, talukas: ["Cuddalore", "Panruti", "Vridhachalam", "Chidambaram", "Kattumannarkoil"] },
      "Dharmapuri": { lat: 12.1357, lng: 78.1560, talukas: ["Dharmapuri", "Harur", "Pappireddipatti", "Pennagaram", "Palacode"] },
      "Dindigul": { lat: 10.3673, lng: 77.9803, talukas: ["Dindigul East", "Dindigul West", "Palani", "Kodaikanal", "Nilakottai", "Oddanchatram"] },
      "Erode": { lat: 11.3410, lng: 77.7172, talukas: ["Erode", "Bhavani", "Gobichettipalayam", "Sathyamangalam", "Perundurai"] },
      "Kallakurichi": { lat: 11.7384, lng: 78.9639, talukas: ["Kallakurichi", "Sankarapuram", "Tirukoilur", "Ulundurpet", "Chinnasalem", "Kalvarayan Hills"] },
      "Kanchipuram": { lat: 12.8342, lng: 79.7036, talukas: ["Kanchipuram", "Sriperumbudur", "Uthiramerur", "Walajabad"] },
      "Kanyakumari": { lat: 8.0883, lng: 77.5385, talukas: ["Agastheeswaram", "Thovalai", "Kalkulam", "Vilavancode"] },
      "Karur": { lat: 10.9601, lng: 78.0766, talukas: ["Karur", "Aravakurichi", "Kulithalai", "Krishnarayapuram"] },
      "Krishnagiri": { lat: 12.5186, lng: 78.2137, talukas: ["Krishnagiri", "Hosur", "Denkanikottai", "Pochampalli", "Uthangarai"] },
      "Madurai": { lat: 9.9252, lng: 78.1198, talukas: ["Madurai North", "Madurai South", "Melur", "Thirumangalam", "Usilampatti", "Vadipatti"] },
      "Mayiladuthurai": { lat: 11.1018, lng: 79.6522, talukas: ["Mayiladuthurai", "Sirkazhi", "Tharangambadi", "Kuthalam"] },
      "Nagapattinam": { lat: 10.7656, lng: 79.8424, talukas: ["Nagapattinam", "Kilvelur", "Vedaranyam"] },
      "Namakkal": { lat: 11.2189, lng: 78.1674, talukas: ["Namakkal", "Rasipuram", "Tiruchengodu", "Paramathi Velur", "Kolli Hills"] },
      "Nilgiris": { lat: 11.4916, lng: 76.7337, talukas: ["Udhagamandalam", "Coonoor", "Kotagiri", "Gudalur"] },
      "Perambalur": { lat: 11.2342, lng: 78.8820, talukas: ["Perambalur", "Kunnam", "Veppanthattai"] },
      "Pudukkottai": { lat: 10.3833, lng: 78.8001, talukas: ["Pudukkottai", "Aranthangi", "Alangudi", "Gandarvakottai", "Iluppur", "Thirumayam"] },
      "Ramanathapuram": { lat: 9.3639, lng: 78.8395, talukas: ["Ramanathapuram", "Paramakudi", "Rameswaram", "Tiruvadanai", "Kadaladi", "Mudukulathur"] },
      "Ranipet": { lat: 12.9296, lng: 79.3330, talukas: ["Ranipet", "Walajah", "Arcot", "Sholinghur", "Arakkonam"] },
      "Salem": { lat: 11.6643, lng: 78.1460, talukas: ["Salem", "Attur", "Mettur", "Omalur", "Yercaud", "Sankari"] },
      "Sivaganga": { lat: 9.8433, lng: 78.4809, talukas: ["Sivaganga", "Karaikudi", "Devakottai", "Manamadurai", "Thirupuvanam"] },
      "Tenkasi": { lat: 8.9593, lng: 77.3150, talukas: ["Tenkasi", "Sankarankovil", "Kadayanallur", "Shenkottai", "Alangulam"] },
      "Thanjavur": { lat: 10.7870, lng: 79.1378, talukas: ["Thanjavur", "Kumbakonam", "Pattukkottai", "Orathanadu", "Thiruvaiyaru", "Papanasam"] },
      "Theni": { lat: 10.0104, lng: 77.4768, talukas: ["Theni", "Periyakulam", "Uthamapalayam", "Bodinayakanur", "Andipatti"] },
      "Thoothukudi": { lat: 8.7642, lng: 78.1348, talukas: ["Thoothukudi", "Tiruchendur", "Kovilpatti", "Ottapidaram", "Ettayapuram", "Srivaikuntam"] },
      "Tiruchirappalli": { lat: 10.7905, lng: 78.7047, talukas: ["Tiruchirappalli East", "Tiruchirappalli West", "Lalgudi", "Manapparai", "Musiri", "Thuraiyur", "Srirangam"] },
      "Tirunelveli": { lat: 8.7139, lng: 77.7567, talukas: ["Tirunelveli", "Palayamkottai", "Ambasamudram", "Nanguneri", "Radhapuram"] },
      "Tirupathur": { lat: 12.4950, lng: 78.5678, talukas: ["Tirupathur", "Vaniyambadi", "Ambur", "Natrampalli"] },
      "Tiruppur": { lat: 11.1085, lng: 77.3411, talukas: ["Tiruppur North", "Tiruppur South", "Avinashi", "Dharapuram", "Palladam", "Udumalaipettai", "Kangeyam"] },
      "Tiruvallur": { lat: 13.1438, lng: 79.9079, talukas: ["Tiruvallur", "Avadi", "Ponneri", "Poonamallee", "Tirutani"] },
      "Tiruvannamalai": { lat: 12.2253, lng: 79.0747, talukas: ["Tiruvannamalai", "Arani", "Cheyyar", "Chengam", "Polur", "Vandavasi"] },
      "Tiruvarur": { lat: 10.7726, lng: 79.6365, talukas: ["Tiruvarur", "Mannargudi", "Thiruthuraipoondi", "Nannilam", "Needamangalam"] },
      "Vellore": { lat: 12.9165, lng: 79.1325, talukas: ["Vellore", "Katpadi", "Gudiyatham", "Anaicut", "K V Kuppam"] },
      "Viluppuram": { lat: 11.9401, lng: 79.4861, talukas: ["Viluppuram", "Tindivanam", "Gingee", "Vikravandi", "Vanur"] },
      "Virudhunagar": { lat: 9.5680, lng: 77.9624, talukas: ["Virudhunagar", "Sivakasi", "Rajapalayam", "Aruppukottai", "Sattur", "Srivilliputhur"] }
    }
  },
  "Haryana": {
    lat: 29.0588,
    lng: 76.0856,
    zoom: 7,
    districts: {
      "Ambala": { lat: 30.3782, lng: 76.7767, talukas: ["Ambala", "Barara", "Naraingarh"] },
      "Bhiwani": { lat: 28.7831, lng: 76.1394, talukas: ["Bhiwani", "Bawani Khera", "Loharu", "Tosham"] },
      "Faridabad": { lat: 28.4089, lng: 77.3178, talukas: ["Faridabad", "Ballabgarh", "Badkhal"] },
      "Gurugram": { lat: 28.4595, lng: 77.0266, talukas: ["Gurugram", "Pataudi", "Sohna", "Farrukhnagar"] },
      "Hisar": { lat: 29.1492, lng: 75.7217, talukas: ["Hisar", "Hansi", "Adampur", "Barwala"] },
      "Jhajjar": { lat: 28.6063, lng: 76.6565, talukas: ["Jhajjar", "Bahadurgarh", "Beri", "Matanhail"] },
      "Jind": { lat: 29.3159, lng: 76.3154, talukas: ["Jind", "Narwana", "Safidon", "Uchana"] },
      "Karnal": { lat: 29.6857, lng: 76.9905, talukas: ["Karnal", "Gharaunda", "Assandh", "Indri", "Nilokheri"] },
      "Kurukshetra": { lat: 29.9695, lng: 76.8783, talukas: ["Thanesar", "Pehowa", "Shahbad", "Ladwa"] },
      "Panipat": { lat: 29.3909, lng: 76.9635, talukas: ["Panipat", "Samalkha", "Israna", "Bapoli"] },
      "Rohtak": { lat: 28.8955, lng: 76.6066, talukas: ["Rohtak", "Meham", "Kalanaur", "Sampla"] },
      "Sirsa": { lat: 29.5339, lng: 75.0210, talukas: ["Sirsa", "Dabwali", "Ellenabad", "Rania"] },
      "Sonipat": { lat: 28.9931, lng: 77.0151, talukas: ["Sonipat", "Gohana", "Ganaur", "Kharkhoda"] }
    }
  },
  "Punjab": {
    lat: 31.1471,
    lng: 75.3412,
    zoom: 7,
    districts: {
      "Amritsar": { lat: 31.6340, lng: 74.8723, talukas: ["Amritsar I", "Amritsar II", "Ajnala", "Baba Bakala"] },
      "Bathinda": { lat: 30.2110, lng: 74.9455, talukas: ["Bathinda", "Rampura Phul", "Talwandi Sabo"] },
      "Jalandhar": { lat: 31.3260, lng: 75.5762, talukas: ["Jalandhar I", "Jalandhar II", "Nakodar", "Phillaur", "Shahkot"] },
      "Ludhiana": { lat: 30.9010, lng: 75.8573, talukas: ["Ludhiana East", "Ludhiana West", "Jagraon", "Khanna", "Payal", "Samrala"] },
      "Patiala": { lat: 30.3398, lng: 76.3869, talukas: ["Patiala", "Nabha", "Rajpura", "Samana", "Patran"] }
    }
  },
  "Maharashtra": {
    lat: 19.7515,
    lng: 75.7139,
    zoom: 7,
    districts: {
      "Ahmednagar": { lat: 19.0948, lng: 74.7480, talukas: ["Nagar", "Rahuri", "Sangamner", "Kopargaon", "Shrirampur", "Shirdi"] },
      "Aurangabad (Chhatrapati Sambhaji Nagar)": { lat: 19.8762, lng: 75.3433, talukas: ["Aurangabad", "Paithan", "Gangapur", "Vaijapur", "Kannad", "Sillod"] },
      "Kolhapur": { lat: 16.7050, lng: 74.2433, talukas: ["Karveer", "Hatkanangale", "Shirol", "Kagal", "Radhanagari"] },
      "Mumbai": { lat: 19.0760, lng: 72.8777, talukas: ["Mumbai City", "Mumbai Suburban"] },
      "Nagpur": { lat: 21.1458, lng: 79.0882, talukas: ["Nagpur Urban", "Nagpur Rural", "Kamptee", "Hingna", "Katol", "Savner", "Ramtek"] },
      "Nashik": { lat: 20.0059, lng: 73.7898, talukas: ["Nashik", "Malegaon", "Sinnar", "Niphad", "Yeola", "Igatpuri", "Dindori"] },
      "Pune": { lat: 18.5204, lng: 73.8567, talukas: ["Haveli", "Pune City", "Baramati", "Shirur", "Indapur", "Daund", "Maval", "Khed", "Junnar"] },
      "Satara": { lat: 17.6805, lng: 74.0183, talukas: ["Satara", "Karad", "Wai", "Mahabaleshwar", "Phaltan", "Koregaon"] },
      "Solapur": { lat: 17.6599, lng: 75.9064, talukas: ["Solapur North", "Solapur South", "Pandharpur", "Barshi", "Sangola", "Akkalkot", "Malshiras"] }
    }
  },
  "Karnataka": {
    lat: 15.3173,
    lng: 75.7139,
    zoom: 7,
    districts: {
      "Bengaluru Urban": { lat: 12.9716, lng: 77.5946, talukas: ["Bengaluru North", "Bengaluru South", "Bengaluru East", "Anekal"] },
      "Belagavi": { lat: 15.8497, lng: 74.4977, talukas: ["Belagavi", "Gokak", "Chikkodi", "Bailhongal", "Athani"] },
      "Ballari": { lat: 15.1394, lng: 76.9214, talukas: ["Ballari", "Siruguppa", "Kurugodu", "Kampli"] },
      "Dharwad": { lat: 15.4589, lng: 75.0078, talukas: ["Dharwad", "Hubballi Urban", "Hubballi Rural", "Kalghatgi", "Navalgund"] },
      "Mysuru": { lat: 12.2958, lng: 76.6394, talukas: ["Mysuru", "Nanjangud", "Hunsur", "T. Narasipura", "K.R. Nagar"] }
    }
  },
  "Uttar Pradesh": {
    lat: 26.8467,
    lng: 80.9462,
    zoom: 7,
    districts: {
      "Agra": { lat: 27.1767, lng: 78.0081, talukas: ["Agra", "Kiraoli", "Fatehabad", "Kheragarh", "Bah"] },
      "Ayodhya": { lat: 26.7922, lng: 82.1998, talukas: ["Sadar", "Rudauli", "Milkipur", "Bikapur", "Sohawal"] },
      "Gorakhpur": { lat: 26.7606, lng: 83.3732, talukas: ["Sadar", "Bansgaon", "Campierganj", "Khajni", "Sahjanwa"] },
      "Kanpur Nagar": { lat: 26.4499, lng: 80.3319, talukas: ["Kanpur Sadar", "Bilhaur", "Ghatampur"] },
      "Lucknow": { lat: 26.8467, lng: 80.9462, talukas: ["Lucknow Sadar", "Malihabad", "Mohanlalganj", "Bakshi Ka Talab"] },
      "Varanasi": { lat: 25.3176, lng: 82.9739, talukas: ["Varanasi Sadar", "Pindra", "Rajatalab"] }
    }
  },
  "Gujarat": {
    lat: 22.2587,
    lng: 71.1924,
    zoom: 7,
    districts: {
      "Ahmedabad": { lat: 23.0225, lng: 72.5714, talukas: ["Ahmedabad City", "Daskroi", "Sanand", "Bavla", "Dholka", "Viramgam"] },
      "Amreli": { lat: 21.6032, lng: 71.2221, talukas: ["Amreli", "Dhari", "Rajula", "Savarkundla", "Babra", "Lathi", "Khambha"] },
      "Anand": { lat: 22.5645, lng: 72.9289, talukas: ["Anand", "Borsad", "Petlad", "Khambhat", "Umreth"] },
      "Banaskantha": { lat: 24.1724, lng: 72.4346, talukas: ["Palanpur", "Deesa", "Dantiwada", "Kankrej", "Tharad", "Dhanera"] },
      "Bharuch": { lat: 21.7051, lng: 72.9959, talukas: ["Bharuch", "Ankleshwar", "Jambusar", "Vagra", "Hansot", "Amod"] },
      "Bhavnagar": { lat: 21.7645, lng: 72.1519, talukas: ["Bhavnagar", "Mahuva", "Palitana", "Talaja", "Gariadhar", "Sihor"] },
      "Gandhinagar": { lat: 23.2156, lng: 72.6369, talukas: ["Gandhinagar", "Kalol", "Dehgam", "Mansa"] },
      "Jamnagar": { lat: 22.4707, lng: 70.0577, talukas: ["Jamnagar", "Lalpur", "Kalavad", "Jamjodhpur", "Jodiya"] },
      "Junagadh": { lat: 21.5222, lng: 70.4579, talukas: ["Junagadh City", "Junagadh Rural", "Keshod", "Manavadar", "Vanthali", "Visavadar"] },
      "Kheda": { lat: 22.7507, lng: 72.6847, talukas: ["Nadiad", "Kheda", "Kapadvanj", "Matar", "Mahudha", "Thasra"] },
      "Kutch": { lat: 23.2420, lng: 69.6669, talukas: ["Bhuj", "Gandhidham", "Anjar", "Mandvi", "Mundra", "Naliya", "Rapar"] },
      "Mehsana": { lat: 23.5880, lng: 72.3693, talukas: ["Mehsana", "Visnagar", "Unjha", "Kadi", "Vadnagar", "Vijapur"] },
      "Morbi": { lat: 22.8173, lng: 70.8368, talukas: ["Morbi", "Wankaner", "Halvad", "Tankara", "Maliya"] },
      "Narmada": { lat: 21.8712, lng: 73.5042, talukas: ["Rajpipla", "Nandod", "Dediyapada", "Sagbara", "Garudeshwar"] },
      "Navsari": { lat: 20.9467, lng: 72.9520, talukas: ["Navsari", "Gandevi", "Chikhli", "Jalalpore", "Bansda"] },
      "Patan": { lat: 23.8493, lng: 72.1266, talukas: ["Patan", "Sidhpur", "Chanasma", "Harij", "Radhanpur", "Sami"] },
      "Porbandar": { lat: 21.6417, lng: 69.6293, talukas: ["Porbandar", "Ranavav", "Kutiyana"] },
      "Rajkot": { lat: 22.3039, lng: 70.8022, talukas: ["Rajkot", "Gondal", "Jetpur", "Jasdan", "Dhoraji", "Morbi", "Paddhari"] },
      "Surat": { lat: 21.1702, lng: 72.8311, talukas: ["Surat City", "Choryasi", "Bardoli", "Kamrej", "Olpad", "Palsana", "Mandvi"] },
      "Surendranagar": { lat: 22.7235, lng: 71.6366, talukas: ["Wadhwan", "Chotila", "Dhrangadhra", "Limbdi", "Sayla", "Thangadh"] },
      "Vadodara": { lat: 22.3072, lng: 73.1812, talukas: ["Vadodara", "Padra", "Dabhoi", "Karjan", "Savli", "Waghodia"] },
      "Valsad": { lat: 20.5992, lng: 72.9342, talukas: ["Valsad", "Vapi", "Pardi", "Umbergaon", "Dharampur", "Kaprada"] }
    }
  },
  "Rajasthan": {
    lat: 27.0238,
    lng: 74.2179,
    zoom: 7,
    districts: {
      "Ajmer": { lat: 26.4499, lng: 74.6399, talukas: ["Ajmer", "Beawar", "Kishangarh", "Kekri", "Nasirabad"] },
      "Alwar": { lat: 27.5530, lng: 76.6346, talukas: ["Alwar", "Bhiwadi", "Behror", "Tijara", "Rajgarh", "Bansur"] },
      "Bikaner": { lat: 28.0229, lng: 73.3119, talukas: ["Bikaner", "Nokha", "Lunkaransar", "Khajuwala", "Dungargarh"] },
      "Jaipur": { lat: 26.9124, lng: 75.7873, talukas: ["Jaipur", "Amber", "Sanganer", "Chomu", "Kotputli", "Phulera", "Shahpura"] },
      "Jodhpur": { lat: 26.2389, lng: 73.0243, talukas: ["Jodhpur", "Phalodi", "Osian", "Bilara", "Luni", "Shergarh"] },
      "Kota": { lat: 25.2138, lng: 75.8648, talukas: ["Kota", "Ladpura", "Sangod", "Ramganj Mandi", "Itawa"] },
      "Udaipur": { lat: 24.5854, lng: 73.7125, talukas: ["Udaipur", "Girwa", "Mavli", "Salumber", "Jhadol", "Kherwara"] }
    }
  },
  "Madhya Pradesh": {
    lat: 22.9734,
    lng: 78.6569,
    zoom: 7,
    districts: {
      "Bhopal": { lat: 23.2599, lng: 77.4126, talukas: ["Huzur", "Berasia"] },
      "Gwalior": { lat: 26.2183, lng: 78.1828, talukas: ["Gwalior", "Dabra", "Bhitarwar"] },
      "Indore": { lat: 22.7196, lng: 75.8577, talukas: ["Indore", "Mhow (Dr. Ambedkar Nagar)", "Sanwer", "Depalpur"] },
      "Jabalpur": { lat: 23.1815, lng: 79.9864, talukas: ["Jabalpur", "Patan", "Sihora", "Kundam"] },
      "Ujjain": { lat: 23.1765, lng: 75.7885, talukas: ["Ujjain", "Nagda", "Khachrod", "Mahidpur", "Tarana", "Barnagar"] }
    }
  },
  "Kerala": {
    lat: 10.8505,
    lng: 76.2711,
    zoom: 7,
    districts: {
      "Alappuzha": { lat: 9.4981, lng: 76.3388, talukas: ["Ambalappuzha", "Cherthala", "Kuttanad", "Karthikappally", "Chengannur", "Mavelikkara"] },
      "Ernakulam": { lat: 9.9816, lng: 76.2999, talukas: ["Kochi", "Kanayannur", "Aluva", "Paravur", "Kothamangalam", "Muvattupuzha", "Kunnathunad"] },
      "Kozhikode": { lat: 11.2588, lng: 75.7804, talukas: ["Kozhikode", "Koyilandy", "Vadakara", "Thamarassery"] },
      "Palakkad": { lat: 10.7867, lng: 76.6548, talukas: ["Palakkad", "Chittur", "Alathur", "Ottapalam", "Mannarkkad", "Pattambi"] },
      "Thiruvananthapuram": { lat: 8.5241, lng: 76.9366, talukas: ["Thiruvananthapuram", "Neyyattinkara", "Nedumangad", "Chirayinkeezhu", "Varkala", "Kattakada"] }
    }
  },
  "Andhra Pradesh": {
    lat: 15.9129,
    lng: 79.7400,
    zoom: 7,
    districts: {
      "Anantapur": { lat: 14.6819, lng: 77.6006, talukas: ["Anantapur", "Dharmavaram", "Guntakal", "Hindupur", "Kalyandurg", "Rayadurg"] },
      "Guntur": { lat: 16.3067, lng: 80.4365, talukas: ["Guntur", "Tenali", "Narasaraopet", "Mangalagiri", "Ponnur"] },
      "Kurnool": { lat: 15.8281, lng: 78.0373, talukas: ["Kurnool", "Nandyal", "Adoni", "Yemmiganur", "Dhone"] },
      "Tirupati": { lat: 13.6288, lng: 79.4192, talukas: ["Tirupati Urban", "Tirupati Rural", "Srikalahasti", "Nagari", "Gudur"] },
      "Visakhapatnam": { lat: 17.6868, lng: 83.2185, talukas: ["Visakhapatnam Urban", "Visakhapatnam Rural", "Anakapalle", "Bheemunipatnam", "Gajuwaka"] }
    }
  },
  "Telangana": {
    lat: 18.1124,
    lng: 79.0193,
    zoom: 7,
    districts: {
      "Hyderabad": { lat: 17.3850, lng: 78.4867, talukas: ["Charminar", "Khairatabad", "Secunderabad", "Golconda", "Amberpet", "Asifnagar"] },
      "Karimnagar": { lat: 18.4386, lng: 79.1288, talukas: ["Karimnagar", "Huzurabad", "Jammikunta", "Manakondur", "Choppadandi"] },
      "Khammam": { lat: 17.2473, lng: 80.1514, talukas: ["Khammam Urban", "Khammam Rural", "Wyra", "Sathupalli", "Madhira"] },
      "Medchal-Malkajgiri": { lat: 17.5472, lng: 78.4869, talukas: ["Malkajgiri", "Kukatpally", "Quthbullapur", "Uppal", "Medchal", "Alwal"] },
      "Warangal": { lat: 17.9689, lng: 79.5941, talukas: ["Warangal", "Hanamkonda", "Kazipet", "Narsampet", "Wardhannapet"] }
    }
  },
  "West Bengal": {
    lat: 22.9868,
    lng: 87.8550,
    zoom: 7,
    districts: {
      "Hooghly": { lat: 22.9056, lng: 88.3924, talukas: ["Chinsurah", "Chandannagar", "Serampore", "Arambagh"] },
      "Howrah": { lat: 22.5958, lng: 88.2636, talukas: ["Howrah Sadar", "Uluberia", "Bally", "Panchla"] },
      "Kolkata": { lat: 22.5726, lng: 88.3639, talukas: ["Kolkata North", "Kolkata South", "Kolkata Central"] },
      "North 24 Parganas": { lat: 22.7244, lng: 88.4747, talukas: ["Barasat", "Barrackpore", "Bidhannagar", "Basirhat", "Bangaon"] },
      "South 24 Parganas": { lat: 22.1352, lng: 88.4016, talukas: ["Alipore", "Baruipur", "Canning", "Diamond Harbour", "Kakdwip"] }
    }
  },
  "Bihar": {
    lat: 25.0961,
    lng: 85.3131,
    zoom: 7,
    districts: {
      "Gaya": { lat: 24.7914, lng: 85.0002, talukas: ["Gaya Sadar", "Bodhgaya", "Tekari", "Sherghati", "Neemchak Bathani"] },
      "Muzaffarpur": { lat: 26.1209, lng: 85.3647, talukas: ["East Muzaffarpur", "West Muzaffarpur", "Kanti", "Motipur"] },
      "Patna": { lat: 25.5941, lng: 85.1376, talukas: ["Patna Sadar", "Danapur", "Barh", "Masaurhi", "Paliyan", "Bakhtiarpur"] }
    }
  },
  "Odisha": {
    lat: 20.9517,
    lng: 85.0985,
    zoom: 7,
    districts: {
      "Bhubaneswar / Khordha": { lat: 20.2961, lng: 85.8245, talukas: ["Bhubaneswar", "Khordha", "Jatni", "Banapur"] },
      "Cuttack": { lat: 20.4625, lng: 85.8828, talukas: ["Cuttack Sadar", "Banki", "Athagarh", "Salepur"] },
      "Puri": { lat: 19.8135, lng: 85.8312, talukas: ["Puri", "Brahmagiri", "Pipili", "Nimapada", "Kakaratpur"] }
    }
  }
};
