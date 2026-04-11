import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Complete list of US States
const US_STATES = [
  { name: "Alabama", abbreviation: "AL", slug: "alabama" },
  { name: "Alaska", abbreviation: "AK", slug: "alaska" },
  { name: "Arizona", abbreviation: "AZ", slug: "arizona" },
  { name: "Arkansas", abbreviation: "AR", slug: "arkansas" },
  { name: "California", abbreviation: "CA", slug: "california" },
  { name: "Colorado", abbreviation: "CO", slug: "colorado" },
  { name: "Connecticut", abbreviation: "CT", slug: "connecticut" },
  { name: "Delaware", abbreviation: "DE", slug: "delaware" },
  { name: "Florida", abbreviation: "FL", slug: "florida" },
  { name: "Georgia", abbreviation: "GA", slug: "georgia" },
  { name: "Hawaii", abbreviation: "HI", slug: "hawaii" },
  { name: "Idaho", abbreviation: "ID", slug: "idaho" },
  { name: "Illinois", abbreviation: "IL", slug: "illinois" },
  { name: "Indiana", abbreviation: "IN", slug: "indiana" },
  { name: "Iowa", abbreviation: "IA", slug: "iowa" },
  { name: "Kansas", abbreviation: "KS", slug: "kansas" },
  { name: "Kentucky", abbreviation: "KY", slug: "kentucky" },
  { name: "Louisiana", abbreviation: "LA", slug: "louisiana" },
  { name: "Maine", abbreviation: "ME", slug: "maine" },
  { name: "Maryland", abbreviation: "MD", slug: "maryland" },
  { name: "Massachusetts", abbreviation: "MA", slug: "massachusetts" },
  { name: "Michigan", abbreviation: "MI", slug: "michigan" },
  { name: "Minnesota", abbreviation: "MN", slug: "minnesota" },
  { name: "Mississippi", abbreviation: "MS", slug: "mississippi" },
  { name: "Missouri", abbreviation: "MO", slug: "missouri" },
  { name: "Montana", abbreviation: "MT", slug: "montana" },
  { name: "Nebraska", abbreviation: "NE", slug: "nebraska" },
  { name: "Nevada", abbreviation: "NV", slug: "nevada" },
  { name: "New Hampshire", abbreviation: "NH", slug: "new-hampshire" },
  { name: "New Jersey", abbreviation: "NJ", slug: "new-jersey" },
  { name: "New Mexico", abbreviation: "NM", slug: "new-mexico" },
  { name: "New York", abbreviation: "NY", slug: "new-york" },
  { name: "North Carolina", abbreviation: "NC", slug: "north-carolina" },
  { name: "North Dakota", abbreviation: "ND", slug: "north-dakota" },
  { name: "Ohio", abbreviation: "OH", slug: "ohio" },
  { name: "Oklahoma", abbreviation: "OK", slug: "oklahoma" },
  { name: "Oregon", abbreviation: "OR", slug: "oregon" },
  { name: "Pennsylvania", abbreviation: "PA", slug: "pennsylvania" },
  { name: "Rhode Island", abbreviation: "RI", slug: "rhode-island" },
  { name: "South Carolina", abbreviation: "SC", slug: "south-carolina" },
  { name: "South Dakota", abbreviation: "SD", slug: "south-dakota" },
  { name: "Tennessee", abbreviation: "TN", slug: "tennessee" },
  { name: "Texas", abbreviation: "TX", slug: "texas" },
  { name: "Utah", abbreviation: "UT", slug: "utah" },
  { name: "Vermont", abbreviation: "VT", slug: "vermont" },
  { name: "Virginia", abbreviation: "VA", slug: "virginia" },
  { name: "Washington", abbreviation: "WA", slug: "washington" },
  { name: "West Virginia", abbreviation: "WV", slug: "west-virginia" },
  { name: "Wisconsin", abbreviation: "WI", slug: "wisconsin" },
  { name: "Wyoming", abbreviation: "WY", slug: "wyoming" },
  { name: "District of Columbia", abbreviation: "DC", slug: "district-of-columbia" },
];

// Major US Cities by State (comprehensive list - top cities per state)
const US_CITIES: Record<string, string[]> = {
  "AL": ["Birmingham", "Montgomery", "Huntsville", "Mobile", "Tuscaloosa", "Hoover", "Dothan", "Auburn", "Decatur", "Madison", "Florence", "Gadsden", "Vestavia Hills", "Prattville", "Phenix City", "Alabaster", "Bessemer", "Enterprise", "Opelika", "Homewood"],
  "AK": ["Anchorage", "Fairbanks", "Juneau", "Sitka", "Ketchikan", "Wasilla", "Kenai", "Kodiak", "Bethel", "Palmer", "Homer", "Soldotna", "Valdez", "Nome", "Barrow", "Kotzebue", "Seward", "Cordova", "Dillingham", "Wrangell"],
  "AZ": ["Phoenix", "Tucson", "Mesa", "Chandler", "Scottsdale", "Glendale", "Gilbert", "Tempe", "Peoria", "Surprise", "Yuma", "Avondale", "Goodyear", "Flagstaff", "Buckeye", "Lake Havasu City", "Casa Grande", "Maricopa", "Sierra Vista", "Prescott", "Bullhead City", "Apache Junction", "Prescott Valley", "Marana", "El Mirage"],
  "AR": ["Little Rock", "Fort Smith", "Fayetteville", "Springdale", "Jonesboro", "Rogers", "Conway", "North Little Rock", "Bentonville", "Pine Bluff", "Hot Springs", "Benton", "Texarkana", "Sherwood", "Jacksonville", "Russellville", "Bella Vista", "West Memphis", "Paragould", "Cabot"],
  "CA": ["Los Angeles", "San Diego", "San Jose", "San Francisco", "Fresno", "Sacramento", "Long Beach", "Oakland", "Bakersfield", "Anaheim", "Santa Ana", "Riverside", "Stockton", "Irvine", "Chula Vista", "Fremont", "San Bernardino", "Modesto", "Fontana", "Moreno Valley", "Santa Clarita", "Glendale", "Huntington Beach", "Garden Grove", "Oceanside", "Rancho Cucamonga", "Santa Rosa", "Ontario", "Elk Grove", "Corona", "Lancaster", "Palmdale", "Salinas", "Pomona", "Hayward", "Escondido", "Sunnyvale", "Torrance", "Pasadena", "Orange", "Fullerton", "Thousand Oaks", "Roseville", "Concord", "Simi Valley", "Santa Clara", "Victorville", "Vallejo", "Berkeley", "El Monte", "Downey", "Costa Mesa", "Inglewood", "Carlsbad", "San Buenaventura", "Fairfield", "West Covina", "Murrieta", "Richmond", "Norwalk", "Antioch", "Temecula", "Burbank", "Daly City", "Rialto", "El Cajon", "San Mateo", "Clovis", "Compton", "Jurupa Valley", "Vista", "South Gate", "Mission Viejo", "Vacaville", "Carson", "Hesperia", "Santa Maria", "Redding", "Westminster", "Santa Monica", "Chico", "Newport Beach", "San Leandro", "San Marcos", "Whittier", "Hawthorne", "Citrus Heights", "Alhambra", "Tracy", "Livermore", "Buena Park", "Menifee", "Hemet", "Lakewood", "Merced", "Chino", "Indio", "Redwood City", "Lake Forest", "Napa", "Tustin", "Bellflower", "Mountain View", "Chino Hills", "Baldwin Park", "Alameda", "Upland", "San Ramon", "Folsom", "Pleasanton", "Lynwood", "Union City", "Apple Valley", "Redlands", "Turlock", "Perris", "Manteca", "Milpitas", "Redondo Beach", "Davis"],
  "CO": ["Denver", "Colorado Springs", "Aurora", "Fort Collins", "Lakewood", "Thornton", "Arvada", "Westminster", "Pueblo", "Centennial", "Boulder", "Greeley", "Longmont", "Loveland", "Grand Junction", "Broomfield", "Castle Rock", "Commerce City", "Parker", "Littleton", "Northglenn", "Brighton", "Englewood", "Wheat Ridge", "Fountain", "Lafayette", "Windsor", "Erie", "Evans", "Golden"],
  "CT": ["Bridgeport", "New Haven", "Stamford", "Hartford", "Waterbury", "Norwalk", "Danbury", "New Britain", "West Hartford", "Greenwich", "Fairfield", "Hamden", "Bristol", "Meriden", "Manchester", "West Haven", "Milford", "Stratford", "East Hartford", "Middletown", "Wallingford", "Southington", "Shelton", "Norwich", "Torrington", "Trumbull", "Glastonbury", "Naugatuck", "Newington", "Vernon"],
  "DE": ["Wilmington", "Dover", "Newark", "Middletown", "Bear", "Glasgow", "Brookside", "Hockessin", "Smyrna", "Milford", "Seaford", "Georgetown", "Elsmere", "New Castle", "Millsboro", "Laurel", "Harrington", "Camden", "Clayton", "Lewes"],
  "FL": ["Jacksonville", "Miami", "Tampa", "Orlando", "St. Petersburg", "Hialeah", "Port St. Lucie", "Cape Coral", "Tallahassee", "Fort Lauderdale", "Pembroke Pines", "Hollywood", "Miramar", "Gainesville", "Coral Springs", "Miami Gardens", "Clearwater", "Palm Bay", "Pompano Beach", "West Palm Beach", "Lakeland", "Davie", "Miami Beach", "Sunrise", "Boca Raton", "Deltona", "Plantation", "Fort Myers", "Palm Coast", "Deerfield Beach", "Largo", "Melbourne", "Boynton Beach", "Lauderhill", "Weston", "Kissimmee", "Homestead", "Delray Beach", "Tamarac", "Daytona Beach", "Wellington", "North Miami", "Jupiter", "Ocala", "Port Orange", "Margate", "Coconut Creek", "Sanford", "Sarasota", "Pensacola", "Bradenton", "Palm Beach Gardens", "Pinellas Park", "Coral Gables", "Doral", "Bonita Springs", "Apopka", "Titusville", "North Port", "Oakland Park", "Fort Pierce", "North Miami Beach", "North Lauderdale", "Cutler Bay", "Altamonte Springs", "St. Cloud", "Greenacres", "Ormond Beach", "Ocoee", "Hallandale Beach", "Winter Garden", "Aventura", "Clermont", "Winter Haven", "Dunedin", "Plant City", "Oviedo", "Royal Palm Beach", "Winter Springs", "Leesburg", "Lauderdale Lakes", "Riviera Beach", "Winter Park", "Estero", "Panama City"],
  "GA": ["Atlanta", "Augusta", "Columbus", "Macon", "Savannah", "Athens", "Sandy Springs", "South Fulton", "Roswell", "Johns Creek", "Warner Robins", "Albany", "Alpharetta", "Marietta", "Valdosta", "Smyrna", "Brookhaven", "Dunwoody", "Peachtree Corners", "Gainesville", "Newnan", "Milton", "Dalton", "Rome", "Peachtree City", "Hinesville", "Douglasville", "Kennesaw", "LaGrange", "Statesboro", "Lawrenceville", "Duluth", "Stockbridge", "Woodstock", "Carrollton", "Canton", "Griffin", "McDonough", "Acworth", "Pooler"],
  "HI": ["Honolulu", "Pearl City", "Hilo", "Kailua", "Waipahu", "Kaneohe", "Mililani Town", "Kahului", "Ewa Gentry", "Mililani Mauka", "Kihei", "Makakilo", "Wahiawa", "Schofield Barracks", "Wailuku", "Kapolei", "Ewa Beach", "Royal Kunia", "Halawa", "Waimalu"],
  "ID": ["Boise", "Meridian", "Nampa", "Idaho Falls", "Caldwell", "Pocatello", "Coeur d'Alene", "Twin Falls", "Lewiston", "Post Falls", "Rexburg", "Moscow", "Eagle", "Kuna", "Ammon", "Chubbuck", "Mountain Home", "Hayden", "Blackfoot", "Garden City"],
  "IL": ["Chicago", "Aurora", "Joliet", "Naperville", "Rockford", "Springfield", "Elgin", "Peoria", "Champaign", "Waukegan", "Cicero", "Bloomington", "Arlington Heights", "Evanston", "Schaumburg", "Decatur", "Bolingbrook", "Palatine", "Skokie", "Des Plaines", "Orland Park", "Tinley Park", "Oak Lawn", "Berwyn", "Mount Prospect", "Normal", "Wheaton", "Hoffman Estates", "Oak Park", "Downers Grove", "Elmhurst", "Glenview", "DeKalb", "Lombard", "Moline", "Buffalo Grove", "Bartlett", "Urbana", "Quincy", "Crystal Lake", "Plainfield", "Streamwood", "Carol Stream", "Romeoville", "Rock Island", "Hanover Park", "Carpentersville", "Wheeling", "Park Ridge", "Addison"],
  "IN": ["Indianapolis", "Fort Wayne", "Evansville", "South Bend", "Carmel", "Fishers", "Bloomington", "Hammond", "Gary", "Lafayette", "Muncie", "Terre Haute", "Kokomo", "Noblesville", "Anderson", "Greenwood", "Elkhart", "Mishawaka", "Lawrence", "Jeffersonville", "Columbus", "Portage", "New Albany", "Richmond", "Westfield", "Valparaiso", "Goshen", "Michigan City", "Marion", "East Chicago"],
  "IA": ["Des Moines", "Cedar Rapids", "Davenport", "Sioux City", "Iowa City", "Waterloo", "Ames", "West Des Moines", "Council Bluffs", "Ankeny", "Dubuque", "Urbandale", "Cedar Falls", "Marion", "Bettendorf", "Mason City", "Marshalltown", "Clinton", "Burlington", "Ottumwa"],
  "KS": ["Wichita", "Overland Park", "Kansas City", "Olathe", "Topeka", "Lawrence", "Shawnee", "Manhattan", "Lenexa", "Salina", "Hutchinson", "Leavenworth", "Leawood", "Dodge City", "Garden City", "Junction City", "Emporia", "Derby", "Prairie Village", "Liberal"],
  "KY": ["Louisville", "Lexington", "Bowling Green", "Owensboro", "Covington", "Richmond", "Georgetown", "Florence", "Hopkinsville", "Nicholasville", "Elizabethtown", "Henderson", "Frankfort", "Independence", "Jeffersontown", "Paducah", "Radcliff", "Ashland", "Madisonville", "Winchester"],
  "LA": ["New Orleans", "Baton Rouge", "Shreveport", "Metairie", "Lafayette", "Lake Charles", "Bossier City", "Kenner", "Monroe", "Alexandria", "Houma", "Marrero", "New Iberia", "Laplace", "Slidell", "Central", "Ruston", "Sulphur", "Harvey", "Hammond"],
  "ME": ["Portland", "Lewiston", "Bangor", "South Portland", "Auburn", "Biddeford", "Sanford", "Brunswick", "Saco", "Westbrook", "Augusta", "Waterville", "Scarborough", "Windham", "Gorham", "Kennebunk", "Falmouth", "Orono", "Presque Isle", "Caribou"],
  "MD": ["Baltimore", "Frederick", "Rockville", "Gaithersburg", "Bowie", "Hagerstown", "Annapolis", "College Park", "Salisbury", "Laurel", "Greenbelt", "Cumberland", "Westminster", "Hyattsville", "Takoma Park", "Easton", "Elkton", "Aberdeen", "Havre de Grace", "Cambridge"],
  "MA": ["Boston", "Worcester", "Springfield", "Cambridge", "Lowell", "Brockton", "New Bedford", "Quincy", "Lynn", "Fall River", "Newton", "Lawrence", "Somerville", "Framingham", "Haverhill", "Waltham", "Malden", "Brookline", "Plymouth", "Medford", "Taunton", "Chicopee", "Weymouth", "Revere", "Peabody", "Methuen", "Barnstable", "Pittsfield", "Attleboro", "Arlington", "Everett", "Salem", "Westfield", "Leominster", "Fitchburg", "Beverly", "Holyoke", "Marlborough", "Woburn", "Chelsea"],
  "MI": ["Detroit", "Grand Rapids", "Warren", "Sterling Heights", "Ann Arbor", "Lansing", "Flint", "Dearborn", "Livonia", "Troy", "Westland", "Farmington Hills", "Kalamazoo", "Wyoming", "Southfield", "Rochester Hills", "Taylor", "Pontiac", "St. Clair Shores", "Royal Oak", "Novi", "Dearborn Heights", "Battle Creek", "Saginaw", "Kentwood", "East Lansing", "Roseville", "Portage", "Midland", "Lincoln Park", "Muskegon", "Meridian Charter Township", "Holland", "Bay City", "Jackson", "Commerce Charter Township", "Waterford", "Shelby Charter Township", "Canton", "Clinton"],
  "MN": ["Minneapolis", "Saint Paul", "Rochester", "Duluth", "Bloomington", "Brooklyn Park", "Plymouth", "Maple Grove", "Woodbury", "St. Cloud", "Eagan", "Eden Prairie", "Coon Rapids", "Burnsville", "Blaine", "Lakeville", "Minnetonka", "Apple Valley", "Edina", "St. Louis Park", "Mankato", "Moorhead", "Shakopee", "Maplewood", "Cottage Grove", "Richfield", "Roseville", "Inver Grove Heights", "Andover", "Brooklyn Center"],
  "MS": ["Jackson", "Gulfport", "Southaven", "Hattiesburg", "Biloxi", "Meridian", "Tupelo", "Olive Branch", "Greenville", "Horn Lake", "Clinton", "Pearl", "Madison", "Starkville", "Ridgeland", "Vicksburg", "Columbus", "Pascagoula", "Brandon", "Oxford"],
  "MO": ["Kansas City", "St. Louis", "Springfield", "Columbia", "Independence", "Lee's Summit", "O'Fallon", "St. Joseph", "St. Charles", "St. Peters", "Blue Springs", "Florissant", "Joplin", "Chesterfield", "Jefferson City", "Cape Girardeau", "Wildwood", "University City", "Ballwin", "Raytown", "Liberty", "Wentzville", "Mehlville", "Kirkwood", "Maryland Heights", "Hazelwood", "Gladstone", "Grandview", "Belton", "Webster Groves"],
  "MT": ["Billings", "Missoula", "Great Falls", "Bozeman", "Butte", "Helena", "Kalispell", "Havre", "Anaconda", "Miles City", "Belgrade", "Livingston", "Laurel", "Whitefish", "Lewistown", "Sidney", "Glendive", "Columbia Falls", "Polson", "Hamilton"],
  "NE": ["Omaha", "Lincoln", "Bellevue", "Grand Island", "Kearney", "Fremont", "Hastings", "Norfolk", "North Platte", "Columbus", "Papillion", "La Vista", "Scottsbluff", "South Sioux City", "Beatrice", "Lexington", "Alliance", "Gering", "Blair", "York"],
  "NV": ["Las Vegas", "Henderson", "Reno", "North Las Vegas", "Sparks", "Carson City", "Fernley", "Elko", "Mesquite", "Boulder City", "Fallon", "Winnemucca", "West Wendover", "Ely", "Yerington", "Carlin", "Lovelock", "Wells", "Caliente", "Hawthorne"],
  "NH": ["Manchester", "Nashua", "Concord", "Derry", "Dover", "Rochester", "Salem", "Merrimack", "Hudson", "Londonderry", "Keene", "Bedford", "Portsmouth", "Goffstown", "Laconia", "Hampton", "Milford", "Durham", "Exeter", "Windham"],
  "NJ": ["Newark", "Jersey City", "Paterson", "Elizabeth", "Lakewood", "Edison", "Woodbridge", "Toms River", "Hamilton", "Trenton", "Clifton", "Camden", "Brick", "Cherry Hill", "Passaic", "Middletown", "Union City", "Old Bridge", "Gloucester Township", "East Orange", "Bayonne", "Franklin", "North Bergen", "Vineland", "Union", "Piscataway", "New Brunswick", "Jackson", "Wayne", "Irvington", "Parsippany-Troy Hills", "Howell", "Perth Amboy", "Hoboken", "Plainfield", "West New York", "Washington Township", "East Brunswick", "Bloomfield", "West Orange"],
  "NM": ["Albuquerque", "Las Cruces", "Rio Rancho", "Santa Fe", "Roswell", "Farmington", "Clovis", "Hobbs", "Alamogordo", "Carlsbad", "Gallup", "Deming", "Los Lunas", "Chaparral", "Sunland Park", "Las Vegas", "Portales", "Artesia", "Lovington", "Silver City"],
  "NY": ["New York", "Buffalo", "Rochester", "Yonkers", "Syracuse", "Albany", "New Rochelle", "Mount Vernon", "Schenectady", "Utica", "White Plains", "Hempstead", "Troy", "Niagara Falls", "Binghamton", "Freeport", "Valley Stream", "Long Beach", "Spring Valley", "Rome", "North Tonawanda", "Ithaca", "Poughkeepsie", "Jamestown", "Elmira", "Middletown", "Auburn", "Lindenhurst", "Rockville Centre", "Newburgh", "Hicksville", "Levittown", "Commack", "Brentwood", "Central Islip", "Huntington", "Smithtown", "West Babylon", "Coram", "Shirley"],
  "NC": ["Charlotte", "Raleigh", "Greensboro", "Durham", "Winston-Salem", "Fayetteville", "Cary", "Wilmington", "High Point", "Concord", "Greenville", "Asheville", "Gastonia", "Jacksonville", "Chapel Hill", "Huntersville", "Apex", "Burlington", "Wake Forest", "Rocky Mount", "Kannapolis", "Matthews", "Sanford", "Mooresville", "Wilson", "Holly Springs", "Hickory", "Indian Trail", "Salisbury", "Monroe", "Cornelius", "Goldsboro", "Lumberton", "Statesville", "Mint Hill", "New Bern", "Thomasville", "Asheboro", "Kernersville", "Morrisville"],
  "ND": ["Fargo", "Bismarck", "Grand Forks", "Minot", "West Fargo", "Williston", "Dickinson", "Mandan", "Jamestown", "Wahpeton", "Devils Lake", "Watford City", "Valley City", "Grafton", "Beulah", "Rugby", "Bottineau", "Hazen", "Horace", "Lincoln"],
  "OH": ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron", "Dayton", "Parma", "Canton", "Youngstown", "Lorain", "Hamilton", "Springfield", "Kettering", "Elyria", "Lakewood", "Cuyahoga Falls", "Middletown", "Euclid", "Newark", "Mansfield", "Mentor", "Beavercreek", "Cleveland Heights", "Strongsville", "Dublin", "Fairfield", "Findlay", "Warren", "Lancaster", "Lima", "Huber Heights", "Westerville", "Marion", "Grove City", "Reynoldsburg", "Delaware", "Upper Arlington", "Westlake", "Gahanna", "Stow"],
  "OK": ["Oklahoma City", "Tulsa", "Norman", "Broken Arrow", "Edmond", "Lawton", "Moore", "Midwest City", "Enid", "Stillwater", "Muskogee", "Bartlesville", "Shawnee", "Owasso", "Ponca City", "Ardmore", "Duncan", "Del City", "Bixby", "Yukon"],
  "OR": ["Portland", "Salem", "Eugene", "Gresham", "Hillsboro", "Beaverton", "Bend", "Medford", "Springfield", "Corvallis", "Albany", "Tigard", "Lake Oswego", "Keizer", "Grants Pass", "Oregon City", "McMinnville", "Redmond", "Tualatin", "West Linn", "Woodburn", "Forest Grove", "Newberg", "Roseburg", "Wilsonville", "Klamath Falls", "Ashland", "Milwaukie", "Coos Bay", "Hermiston"],
  "PA": ["Philadelphia", "Pittsburgh", "Allentown", "Reading", "Scranton", "Bethlehem", "Lancaster", "Harrisburg", "Altoona", "Erie", "York", "Wilkes-Barre", "Chester", "Williamsport", "Easton", "Lebanon", "Hazleton", "New Castle", "Johnstown", "McKeesport", "Hermitage", "Greensburg", "Pottsville", "Sharon", "Butler", "Washington", "Meadville", "Uniontown", "Oil City", "Connellsville"],
  "RI": ["Providence", "Warwick", "Cranston", "Pawtucket", "East Providence", "Woonsocket", "Coventry", "Cumberland", "North Providence", "South Kingstown", "West Warwick", "Johnston", "North Kingstown", "Newport", "Bristol", "Westerly", "Smithfield", "Lincoln", "Central Falls", "Portsmouth"],
  "SC": ["Charleston", "Columbia", "North Charleston", "Mount Pleasant", "Rock Hill", "Greenville", "Summerville", "Goose Creek", "Sumter", "Hilton Head Island", "Spartanburg", "Florence", "Myrtle Beach", "Aiken", "Anderson", "Greer", "Mauldin", "Greenwood", "North Augusta", "Easley"],
  "SD": ["Sioux Falls", "Rapid City", "Aberdeen", "Brookings", "Watertown", "Mitchell", "Yankton", "Pierre", "Huron", "Vermillion", "Spearfish", "Brandon", "Box Elder", "Sturgis", "Madison", "Belle Fourche", "Harrisburg", "Tea", "Dell Rapids", "Mobridge"],
  "TN": ["Nashville", "Memphis", "Knoxville", "Chattanooga", "Clarksville", "Murfreesboro", "Franklin", "Jackson", "Johnson City", "Bartlett", "Hendersonville", "Kingsport", "Collierville", "Smyrna", "Cleveland", "Brentwood", "Germantown", "Columbia", "La Vergne", "Spring Hill", "Gallatin", "Cookeville", "Lebanon", "Mount Juliet", "Morristown", "Oak Ridge", "Maryville", "Bristol", "Farragut", "Shelbyville"],
  "TX": ["Houston", "San Antonio", "Dallas", "Austin", "Fort Worth", "El Paso", "Arlington", "Corpus Christi", "Plano", "Laredo", "Lubbock", "Garland", "Irving", "Amarillo", "Grand Prairie", "Brownsville", "McKinney", "Frisco", "Pasadena", "Killeen", "McAllen", "Mesquite", "Midland", "Denton", "Waco", "Carrollton", "Round Rock", "Abilene", "Odessa", "Pearland", "Richardson", "Beaumont", "College Station", "League City", "Lewisville", "Tyler", "Allen", "Edinburg", "San Angelo", "Wichita Falls", "Conroe", "Sugar Land", "The Woodlands", "New Braunfels", "Bryan", "Temple", "Flower Mound", "Missouri City", "Pharr", "Baytown", "North Richland Hills", "Longview", "Cedar Park", "Mansfield", "Georgetown", "Victoria", "Harlingen", "San Marcos", "Pflugerville", "Rowlett", "Galveston", "Euless", "DeSoto", "Port Arthur", "Grapevine", "Bedford", "Cedar Hill", "Texas City", "Wylie", "Haltom City", "Keller", "Rockwall", "Burleson", "Coppell", "Huntsville", "Duncanville", "Sherman", "The Colony", "Hurst", "Lancaster", "Texarkana", "Friendswood", "Weslaco", "Little Elm", "Mission", "Lake Jackson", "Lufkin", "Schertz", "Leander", "Kyle", "Nacogdoches", "Corinth", "Del Rio"],
  "UT": ["Salt Lake City", "West Valley City", "Provo", "West Jordan", "Orem", "Sandy", "Ogden", "St. George", "Layton", "South Jordan", "Lehi", "Millcreek", "Taylorsville", "Logan", "Murray", "Draper", "Bountiful", "Riverton", "Roy", "Spanish Fork", "Pleasant Grove", "Cottonwood Heights", "Tooele", "Springville", "Cedar City", "Midvale", "Kaysville", "Holladay", "American Fork", "Clearfield"],
  "VT": ["Burlington", "South Burlington", "Rutland", "Barre", "Montpelier", "Winooski", "St. Albans", "Newport", "Vergennes", "Middlebury", "Bennington", "Brattleboro", "Milton", "Hartford", "Essex Junction", "Colchester", "St. Johnsbury", "Morristown", "Williston", "Shelburne"],
  "VA": ["Virginia Beach", "Norfolk", "Chesapeake", "Richmond", "Newport News", "Alexandria", "Hampton", "Roanoke", "Portsmouth", "Suffolk", "Lynchburg", "Harrisonburg", "Leesburg", "Charlottesville", "Danville", "Manassas", "Fredericksburg", "Winchester", "Salem", "Staunton", "Herndon", "Hopewell", "Fairfax", "Christiansburg", "Blacksburg", "Colonial Heights", "Radford", "Culpeper", "Vienna", "Warrenton"],
  "WA": ["Seattle", "Spokane", "Tacoma", "Vancouver", "Bellevue", "Kent", "Everett", "Renton", "Spokane Valley", "Federal Way", "Yakima", "Bellingham", "Kirkland", "Kennewick", "Auburn", "Pasco", "Marysville", "Lakewood", "Redmond", "Sammamish", "Richland", "Burien", "Olympia", "Lacey", "Edmonds", "Bremerton", "Puyallup", "Longview", "Shoreline", "Issaquah", "Lynnwood", "Bothell", "University Place", "Wenatchee", "Mount Vernon", "SeaTac", "Pullman", "Des Moines", "Lake Stevens", "Mercer Island"],
  "WV": ["Charleston", "Huntington", "Morgantown", "Parkersburg", "Wheeling", "Weirton", "Fairmont", "Martinsburg", "Beckley", "Clarksburg", "South Charleston", "Teays Valley", "St. Albans", "Vienna", "Bluefield", "Cross Lanes", "Moundsville", "Bridgeport", "Oak Hill", "Dunbar"],
  "WI": ["Milwaukee", "Madison", "Green Bay", "Kenosha", "Racine", "Appleton", "Waukesha", "Eau Claire", "Oshkosh", "Janesville", "West Allis", "La Crosse", "Sheboygan", "Wauwatosa", "Fond du Lac", "New Berlin", "Wausau", "Brookfield", "Greenfield", "Beloit", "Franklin", "Oak Creek", "Manitowoc", "West Bend", "Sun Prairie", "Superior", "Stevens Point", "Neenah", "Fitchburg", "Muskego"],
  "WY": ["Cheyenne", "Casper", "Laramie", "Gillette", "Rock Springs", "Sheridan", "Green River", "Evanston", "Riverton", "Cody", "Jackson", "Rawlins", "Lander", "Torrington", "Powell", "Douglas", "Worland", "Buffalo", "Wheatland", "Newcastle"],
  "DC": ["Washington"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action } = await req.json();

    if (action === "seed_all") {
      let statesInserted = 0;
      let statesUpdated = 0;
      let citiesInserted = 0;
      let citiesSkipped = 0;

      // First, insert/update all states using upsert for efficiency
      const stateRecords = US_STATES.map((state, index) => ({
        name: state.name,
        abbreviation: state.abbreviation,
        slug: state.slug,
        country_code: "US",
        is_active: true,
        seo_status: "inactive",
        page_exists: false,
        display_order: index + 1,
      }));

      // Upsert states in a single batch
      const { data: upsertedStates, error: stateError } = await supabase
        .from("states")
        .upsert(stateRecords, { onConflict: "abbreviation", ignoreDuplicates: false })
        .select("id, abbreviation");

      if (stateError) {
        console.error("State upsert error:", stateError);
      } else {
        statesInserted = upsertedStates?.length || 0;
      }

      // Get all states with their IDs
      const { data: allStates } = await supabase
        .from("states")
        .select("id, abbreviation");

      const stateMap = new Map(allStates?.map((s) => [s.abbreviation, s.id]) || []);

      // Prepare all city records
      const allCityRecords: Array<{
        name: string;
        slug: string;
        state_id: string;
        country: string;
        is_active: boolean;
        seo_status: string;
        page_exists: boolean;
      }> = [];

      for (const [abbr, cities] of Object.entries(US_CITIES)) {
        const stateId = stateMap.get(abbr);
        if (!stateId) continue;

        for (const cityName of cities) {
          const slug = cityName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-");

          allCityRecords.push({
            name: cityName,
            slug,
            state_id: stateId,
            country: "United States",
            is_active: true,
            seo_status: "inactive",
            page_exists: false,
          });
        }
      }

      // Batch insert cities - 500 at a time to avoid timeouts and bypass 1000 limit
      const BATCH_SIZE = 500;
      for (let i = 0; i < allCityRecords.length; i += BATCH_SIZE) {
        const batch = allCityRecords.slice(i, i + BATCH_SIZE);
        
        // Use upsert to avoid duplicate errors
        const { data: insertedCities, error: cityError } = await supabase
          .from("cities")
          .upsert(batch, { 
            onConflict: "slug,state_id",
            ignoreDuplicates: true 
          })
          .select("id");

        if (cityError) {
          console.error(`City batch ${i / BATCH_SIZE + 1} error:`, cityError);
          citiesSkipped += batch.length;
        } else {
          citiesInserted += insertedCities?.length || 0;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Seeded US locations successfully`,
          stats: {
            statesInserted,
            statesUpdated,
            totalStates: US_STATES.length,
            citiesInserted,
            citiesSkipped,
            totalCitiesInData: allCityRecords.length,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_stats") {
      const { count: stateCount } = await supabase
        .from("states")
        .select("*", { count: "exact", head: true });
      
      const { count: cityCount } = await supabase
        .from("cities")
        .select("*", { count: "exact", head: true });

      const { count: activeCityPages } = await supabase
        .from("cities")
        .select("*", { count: "exact", head: true })
        .eq("seo_status", "live");

      const { count: activeStatePages } = await supabase
        .from("states")
        .select("*", { count: "exact", head: true })
        .eq("seo_status", "live");

      return new Response(
        JSON.stringify({
          success: true,
          stats: {
            totalStates: stateCount,
            totalCities: cityCount,
            activeStatePages,
            activeCityPages,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
