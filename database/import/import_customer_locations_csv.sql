-- ============================================================================
-- CUSTOMER LOCATIONS CSV IMPORT SCRIPT
-- Imports customer data from Take 1.csv with GPS coordinates
-- Includes data cleaning, BP identification, and quality scoring
-- ============================================================================

-- Prerequisites: Run create_customer_locations_system.sql first

-- Generate unique import batch ID for tracking
BEGIN; -- Explicit transaction start

DO $$
DECLARE
  batch_id UUID := gen_random_uuid();
  imported_count INTEGER := 0;
  skipped_count INTEGER := 0;
  bp_customer_count INTEGER := 0;
  error_count INTEGER := 0;
  customer_rec RECORD;
  bp_rec RECORD;
  region_rec RECORD;
  type_rec RECORD;
BEGIN
  RAISE NOTICE 'Starting customer locations import with batch ID: %', batch_id;
  
  -- Create temporary table for CSV data import
  CREATE TEMP TABLE temp_customer_import (
    customer_name TEXT,
    transaction_count TEXT,
    location_name TEXT,
    latitude TEXT,
    longitude TEXT
  );
  
  RAISE NOTICE 'Created temporary import table';
  
  -- Insert customer data from CSV
  -- Note: This data structure matches the CSV file provided
  INSERT INTO temp_customer_import (customer_name, transaction_count, location_name, latitude, longitude) VALUES
    ('KCGM FIMISTON EX KEWDALE', '3333', 'KCGM Fimiston Fuel Farm', '-30.761841', '121.503301'),
    ('BHP NiW - Yakabindi Operations', '3080', '', '-27.414873', '120.580672'),
    ('QUBE PORTS - OSR - FREMANTLE MACHIN', '2830', 'Qube Ports', '-32.039201', '115.750829'),
    ('KCGM FIMISTON EX KALGOORLIE', '2698', 'KCGM Fimiston Fuel Farm', '-30.761841', '121.503301'),
    ('TALISON LITHIUM MSA', '2426', 'Talison Mine MSA Tanks, Talison Mine TSF Tanks ', '-33.850665', '116.071728'),
    ('BP CARNARVON', '1966', 'Outback Travelstop Carnarvon', '-24.862947', '113.712818'),
    ('SOUTH32 BBM MARRADONG SADDLEBACK', '1590', 'Marradong', '', ''),
    ('BP Sorrento', '1565', '', '-31.83240170687886', '115.7477594803415'),
    ('BP THE LAKES', '1455', '', '-31.875325', '116.320749'),
    ('BP WONTHELLA', '1410', '', '-28.75783481972983', '114.62503285664982'),
    ('BIG BELL GOLD - DAY DAWN', '1403', '', '-27.46517579156691', '117.85183603727343'),
    ('NSR - JUNDEE SURFACE EX GER', '1194', '', '-26.36215', '120.6186'),
    ('NSR - ORELIA MINE SITE SURFACE', '1162', '', '-27.378438', '121.008686'),
    ('BP GOLDEN GATE', '1134', '', '-30.75284214736674', '121.46587098557687'),
    ('BP FLORES RD', '938', '', '-28.74988421254385', '114.62875276623447'),
    ('AWR - NARNGULU EAST - A62535', '936', '', '-28.812339760448403', '114.68730015846985'),
    ('BHP NiW - Kalgoorlie, Mt Keith', '906', '', '-27.414873', '120.580672'),
    ('MT MAGNET GOLD - HILL 50', '890', '', '-28.028741986504993', '117.81464848667721'),
    ('ST IVES INVINCIBLE', '858', '', '-31.275994', '121.678404'),
    ('SOUTH32 BBM SADDLEBACK FULL', '838', '', '-32.863166', '116.435533'),
    ('EMR GOLDEN GROVE', '824', '', '-28.762983', '116.960038'),
    ('TALISON LITHIUM MSA TSF LV', '810', 'Talison Mine MSA Tanks, Talison Mine TSF Tanks', '-33.850665', '116.071728'),
    ('BHP NiW - Coogee, Kwinana Nickel', '796', '', '-32.253811764035504', '115.76616660726036'),
    ('BIG BELL GOLD - BLUEBIRD MINE (MULT', '755', '', '-26.71111543014231', '118.42415301686327'),
    ('AGNEW WAROONGA', '704', '', '-28.00908692130598', '120.50785973070406'),
    ('AWR - KALGOORLIE - A25716 (Delivere', '704', '', '-30.776039776762286', '121.42552194802053'),
    ('KCGM MT CHARLOTTE', '653', '', '-30.74321', '121.478924'),
    ('PIACENTINI - MYARA', '642', '', '-32.482376', '116.110245'),
    ('GSM WALLABY', '631', '', '-28.849430153470248', '122.315222981495'),
    ('AWR FORRESTFIELD T70 CARRIER', '574', '', '-31.956574', '115.990248'),
    ('GENESIS MINERALS ADMIRAL', '562', '', '-29.193758747831623', '121.37881741330105'),
    ('GENESIS MINERALS GWALIA MAIN TANKS', '546', '', '-28.92321935308306', '121.32919480226971'),
    ('BP KAMBALDA', '526', '', '-31.19831638443268', '121.65159536603078'),
    ('BP KALGOORLIE TRUCKSTOP', '525', '', '-30.805220652223724', '121.49007087996621'),
    ('BHP NiW - Kalgoorlie, Leinster', '496', '', '-27.819521079749116', '120.69917732659566'),
    ('QUBE LOG (WA) -SPARE-EQUIPMENT TRON', '496', '', '-32.146367', '115.783697'),
    ('PMR - WA LIMESTONE BIBRA LAKE', '466', '', '-32.10596374268404', '115.80542349598905'),
    ('BGC HAZELMERE', '458', '', '-31.911387604910864', '116.00781740677995'),
    ('NSR - STH KALG - ACM/NSMS SURFACE', '456', '', '-31.03862136182581', '121.60885320163011'),
    ('KARORA HIGGINSVILLE POWER LV', '450', '', '-31.73497841773932', '121.7230973160491'),
    ('AU AIRPT JANDAKOT', '439', '', '-32.095997882993565', '115.87559002610982'),
    ('EDNA MAY MINE EX MERREDIN DEPOT', '436', '', '-31.28643567559718', '118.69516540082127'),
    ('LINFOX - KEWDALE (DEL)', '433', '', '-31.98337551573905', '115.97140466640093'),
    ('NSR - KANOWNA BELLE SURFACE', '424', '', '-30.605721380471923', '121.57505348949616'),
    ('AWR KWINANA A25713', '418', '', '-32.242169', '115.785051'),
    ('MT MAGNET GOLD - PENNY WEST EX', '416', '', '-28.850258845846525', '118.81900713394177'),
    ('AWR - PICTON TRIP SERVICE - A25718', '412', '', '-33.345966', '115.712348'),
    ('AU AIRPT BUSSELTON', '408', '', '-33.686887', '115.398892'),
    ('CHARLES HULL-WAROONA EX KEWDALE', '405', '', '-32.833086', '115.915921'),
    ('MARLEYS TRANSPORT - HOPE VALLEY', '390', '', '-31.516348', '118.165244'),
    ('ST IVES NEPTUNE', '386', '', '-31.296334', '121.747988'),
    ('URBAN RESOURCES BIBRA LAKE', '376', '', '-32.10745627855023', '115.81710675929844'),
    ('KARARA MINING LIMITED MINE SITE', '374', '', '-29.187242', '116.75776'),
    ('TOLEDO AUSCO - WHITE FOIL', '364', '', '-30.781151075235424', '121.24409799717226'),
    ('AGNEW NEW HOLLAND', '361', '', '-27.983999', '120.494267'),
    ('EDNA MAY MLG OZ', '360', '', '-31.28643567559718', '118.69516540082127'),
    ('QUBE LOG (WA) RS2020 KALMAR REACH', '360', '', '', ''),
    ('BP MEEKATHARRA OPT', '350', '', '-26.59739775836114', '118.49223232539711'),
    ('TOLEDO AUSCO - MILLENIUM SURFACE', '349', '', '', ''),
    ('ST IVES ATHENA', '346', '', '-31.398369', '121.801144'),
    ('ST IVES REVENGE', '342', '', '-31.271834', '121.72593'),
    ('MT MAGNET GOLD CUE GOLD PROJECT', '334', '', '', ''),
    ('QUBE LOG (WA) - KONECRANES - 49826', '334', '', '-32.043627', '115.73788'),
    ('TOLEDO AUSCO - RAYJAX FUEL FACILITY', '331', '', '-30.767964', '121.118335'),
    ('QUBE BULK - KALGOORLIE BULK TANK', '328', '', '-30.77880481918805', '121.42318222253205'),
    ('SOUTH32 WORSLEY REFINERY GARAGE', '324', '', '', ''),
    ('CHARLES HULL-NORTH DANDALUP', '318', '', '', ''),
    ('MARLEYS TRANSPORT - MILNE FEEDS', '315', '', '', ''),
    ('AU REF KWINANA', '314', '', '', ''),
    ('ST IVES HAULAGE', '306', '', '', ''),
    ('KARORA BETA HUNT MINING', '304', '', '', ''),
    ('QUBE PORTS-KWINANA MACHINERY', '302', '', '', ''),
    ('NSR - RAMONE MINE SITE', '297', '', '', ''),
    ('TOLEDO AUSCO - PARADIGM OPEN PIT', '296', '', '', ''),
    ('BARTO GOLD MINING', '288', '', '', ''),
    ('KUNDANA GOLD - RUBICON SURFACE', '284', '', '', ''),
    ('LINFOX HAZELMERE (DEL)', '284', '', '', ''),
    ('TOLEDO AUSCO - KUNDANA POWER STATIO', '274', '', '', ''),
    ('WESTERN POWER SOUTH METRO DEPOT', '274', '', '', ''),
    ('BGC THE LAKES', '273', '', '', ''),
    ('B & J CATALANO - BRUNSWICK JUNCTION', '272', '', '', ''),
    ('GSM PROCESSING', '258', '', '', ''),
    ('QUBE LOG (WA) EC1035 KALMAR EMPTY', '258', '', '', ''),
    ('QUBE LOG (WA) RS2021 KALMAR R', '246', '', '', ''),
    ('SILVERLAKE ROTHSAY EX KEWDALE', '244', '', '', ''),
    ('BISHOPS TRANSPORT - FORRESTFIELD', '242', '', '', ''),
    ('PIACENTINI - TIWEST PROJECT CATABY', '232', '', '', ''),
    ('QUBE LOG (WA) -SPARE-EQUIPMENT CENT', '230', '', '', ''),
    ('NSR - JUNDEE SURFACE', '226', '', '', ''),
    ('TOLEDO AUSCO - MLG SURFACE', '226', '', '', ''),
    ('AU CONSGN CANNING VALE OPT', '224', '', '', ''),
    ('ARAGON FORTNUM SINGLE', '222', '', '', ''),
    ('VEOLIA R&R BIBRA LAKE 29KL', '222', '', '', ''),
    ('NSR - RAMONE MINE SITE EX GERALD', '219', '', '', ''),
    ('Piacentini Tiwest Project Cataby', '218', '', '', ''),
    ('SILVERLAKE SANTA MINE', '218', '', '', ''),
    ('BGC PRECAST KWINANA BEACH', '212', '', '', ''),
    ('Public Transport Authority of WA Ea', '208', '', '', ''),
    ('BGC SOUTH GUILDFORD', '200', '', '', ''),
    ('MT MAGNET GOLD - GALAXY', '199', '', '', ''),
    ('AU AIRPT KALGOORLIE', '192', '', '', ''),
    ('AWR - ALBANY Y POINT - A25720', '190', '', '', ''),
    ('CITY OF CANNING MAIN DEPOT', '190', '', '', ''),
    ('QUBE LOG (WA) -SPARE-EQUIPMENT ROUS', '190', '', '', ''),
    ('KUNDANA GOLD - MLG SURFACE KUND', '188', '', '', ''),
    ('HPS TRANSPORT - PERTH TANK', '186', '', '', ''),
    ('CITY OF MANDURAH - PARK ROAD', '184', '', '', ''),
    ('SILVERLAKE RANDALLS', '179', '', '', ''),
    ('MT MAGNET GOLD - BLACKCAT MINE', '176', '', '', ''),
    ('QUBE LOG (WA) FUEL POD', '174', '', '', ''),
    ('SILVERLAKE FRENCH KISS', '172', '', '', ''),
    ('BHP NiW - Kalgoorlie, Cliffs Underg', '171', '', '', ''),
    ('PMR - WA BLUEMETAL WHITBY-BYFORD', '170', '', '', ''),
    ('SILVERLAKE MAXWELLS PIT', '168', '', '', ''),
    ('VPL TRANSPORT (WA) PTY LTD - MIDVAL', '165', '', '', ''),
    ('NSR CDO OPERATIONS (DELIVERED)', '162', '', '', ''),
    ('CITY OF CANNING TRANSFER STATION', '161', '', '', ''),
    ('GENESIS MINERALS ULYSSES', '160', '', '', ''),
    ('KUNDANA GOLD - RALEIGH SURFACE', '160', '', '', ''),
    ('QUBE LOG (WA) - CENTRAL CONTAINER P', '160', '', '', ''),
    ('INCHCAPE BIBRA LAKE', '157', '', '', ''),
    ('QUBE LOG (WA) - LIFT RIGHT HIRE', '156', '', '', ''),
    ('BGC ARMADALE', '154', '', '', ''),
    ('RGR PERTH TANK', '154', '', '', ''),
    ('AWR - ALBANY Y PIOINT - A25720', '152', '', '', ''),
    ('BARTO GOLD AXEHANDLE', '152', '', '', ''),
    ('FREMANTLE PORT AUTHORITY - SMALL CR', '150', '', '', ''),
    ('SILVERLAKE - ROTHSAY EX KEWDALE', '150', '', '', ''),
    ('IMAGE RESOURCES ATLAS MINE GSF', '148', '', '', ''),
    ('SILVERLAKE DAISY WORKSHOP', '146', '', '', ''),
    ('PMR - WA PREMIX NEERABUP', '144', '', '', ''),
    ('CSBP LIMITED ALBANY', '140', '', '', ''),
    ('DPAW - WALPOLE', '140', '', '', ''),
    ('ST IVES LEVIATHAN', '140', '', '', ''),
    ('BGC STAKEHILL MANDURAH', '136', '', '', ''),
    ('SMRC - CANNING VALE', '136', '', '', ''),
    ('SILVER LAKE SANTA MINE', '130', '', '', ''),
    ('SHARK BAY MINESITE DSL', '128', '', '', ''),
    ('DEPT PARKS & WILDLIFE - MUNDARING', '127', '', '', ''),
    ('DYNO NOBEL KALGOORLIE ANFO', '126', '', '', ''),
    ('PILBARA CEMENT - KWINANA TANK', '125', '', '', ''),
    ('PILBARA CEMENT - KALGOORLIE', '124', '', '', ''),
    ('QUBE LOG (WA) - HENDERSON (TRONOX)', '124', '', '', ''),
    ('SILVERLAKE - MAXWELLS PIT', '124', '', '', ''),
    ('GREENSTONE RESOURCES VAULT KING OF', '123', '', '', ''),
    ('NSR - STH KALG - RIVET SURFACE', '120', '', '', ''),
    ('AWR DIL KWINANA TRONOX', '117', '', '', ''),
    ('CITY OF ROCKINGHAM DEPOT', '117', '', '', ''),
    ('CHARLES HULL - COOLUP', '116', '', '', ''),
    ('CITY OF SWAN - ULTIMATE DIESEL', '114', '', '', ''),
    ('CHARLES HULL WAGERUP', '112', '', '', ''),
    ('KARORA HIGGINSVILLE TWO BOYS', '112', '', '', ''),
    ('Public Transport Authority of WA Ke', '112', '', '', ''),
    ('LAND TRANSPORT - PERTH', '110', '', '', ''),
    ('BARTO GOLD NEW TANK', '109', '', '', ''),
    ('NSR MLG WORKSHOP BRONZEWING', '108', '', '', ''),
    ('ST IVES LAKE LEFROY', '108', '', '', ''),
    ('SYNERGY - KALGOORLIE', '106', '', '', ''),
    ('BGC BASSENDEAN', '104', '', '', ''),
    ('NSR - PARKESTON POWER STATION', '104', '', '', ''),
    ('QUBE LOG (WA) - BOBCAT F457 (TRONOX', '104', '', '', ''),
    ('SILVERLAKE - RANDALLS', '104', '', '', ''),
    ('GENESIS MINERALS GWALIA POWERHOUSE', '102', '', '', ''),
    ('ST IVES LEFROY', '102', '', '', ''),
    ('VEOLIA R&R NTH BANNISTER 27.5KL', '102', '', '', ''),
    ('NSR PORPHYRY OPERATIONS (DELIVERED)', '100', '', '', ''),
    ('PIACENTINI - IMAGE ATLAS MINE KEWDA', '100', '', '', ''),
    ('Eastern Metropolitan Regional Counc', '98', '', '', ''),
    ('AU TERM KALGOORLIE', '97', '', '', ''),
    ('BFS ENERGY', '96', '', '', ''),
    ('BGC CEMENT WEST', '96', '', '', ''),
    ('BGC MOORA', '96', '', '', ''),
    ('CASTROL - NTH FREMANTLE', '96', '', '', ''),
    ('ST IVES INVINCIBLE (S068)', '96', '', '', ''),
    ('TOLEDO AUSCO MGO CAMP', '96', '', '', ''),
    ('SWAN TRANSIT KARRINYUP', '94', '', '', ''),
    ('URBAN RESOURCES HOPE VALLEY', '94', '', '', ''),
    ('CITY OF ROCKINGHAM LANDFILL &', '89', '', '', ''),
    ('ARAGON FORTNUM POCKET', '88', '', '', ''),
    ('B & J CATALANO - AUSTRALIND', '88', '', '', ''),
    ('CITY OF STIRLING - BALCATTA', '88', '', '', ''),
    ('VEOLIA WELSHPOOL 90KL BULK TANK GSF', '88', '', '', ''),
    ('BHP NiW - Kalgoorlie Nickel Smelter', '86', '', '', ''),
    ('CITY OF GOSNELLS - MAIN DEPOT - G10', '84', '', '', ''),
    ('PMR - WA PREMIX MANDURAH', '84', '', '', ''),
    ('TOLEDO AUSCO-MUNGARI (WHITE FOIL)', '84', '', '', ''),
    ('QUBE PORTS-FKL00023- FREMANTLE', '80', '', '', ''),
    ('WESTERN POWER - KEWDALE', '80', '', '', ''),
    ('bp Singleton', '78', '', '', ''),
    ('CSBP LTD - STORES 27K TANK', '78', '', '', ''),
    ('KARORA BETA HUNT POWER GEN', '78', '', '', ''),
    ('BARTO GOLD FRASERS MINE', '76', '', '', ''),
    ('City of Armadale Kelmscott', '76', '', '', ''),
    ('City of Armadale(Hopkinson Rd) Arma', '76', '', '', ''),
    ('Public Transport Authority of WA Al', '76', '', '', ''),
    ('ST IVES WEIGHBRIDGE', '76', '', '', ''),
    ('BGC QUINNS ROCK', '74', '', '', ''),
    ('LIMESTONE BB - CARABOODA', '74', '', '', ''),
    ('AWR KWINANA BEACH CONTAINER PORT', '72', '', '', ''),
    ('URBAN RESOURCES NOWERGUP', '72', '', '', ''),
    ('SWAN TRANSIT JANDAKOT', '71', '', '', ''),
    ('BGC VULCAN RD CANNING VALE', '70', '', '', ''),
    ('SILVER LAKE FRENCH KISS', '70', '', '', ''),
    ('SILVERLAKE - DAISY WORKSHOP', '70', '', '', ''),
    ('SOUTH32 WORSLEY REFINERY MAIN', '70', '', '', ''),
    ('AU AIRPT LEONORA', '68', '', '', ''),
    ('NSR - MLG WORKSHOP BRONZEWING', '66', '', '', ''),
    ('EMRC - HAZELMERE', '64', '', '', ''),
    ('GOLD ROAD YAMANA EXPLORATION CAMP', '64', '', '', ''),
    ('SWAN TRANSIT JOONDALUP', '64', '', '', ''),
    ('ARAGON - FORTNUM GOLD PROJECT', '62', '', '', ''),
    ('BHP AIR Bulk DEL Leinster', '62', '', '', ''),
    ('BISHOPS CARNARVON (SPLIT LOAD)', '62', '', '', ''),
    ('DYNO NOBEL - KALGOORLIE - ANFO', '62', '', '', ''),
    ('FREO GROUP � KWINANA', '62', '', '', ''),
    ('KARORA LAKEWOOD MILL', '62', '', '', ''),
    ('SWAN TRANSIT WANGARA', '62', '', '', ''),
    ('CHARLES HULL COOLUP EX COOGEE', '60', '', '', ''),
    ('CITY OF CANNING WHALEBACK GOLF COUR', '60', '', '', ''),
    ('NSR - BRONZEWING CAMP', '60', '', '', ''),
    ('SILVER LAKE RANDALLS', '60', '', '', ''),
    ('SWAN TRANSIT BECKENHAM', '60', '', '', ''),
    ('BGC MIDDLE SWAN WHITEMANS TANK', '58', '', '', ''),
    ('QUBE PORTS - OSR - FREMANTLE', '58', '', '', ''),
    ('URBAN RESOURCES THE LAKES', '58', '', '', ''),
    ('VEOLIA R&R NTH BANNISTER 29KL BULK', '58', '', '', ''),
    ('BURSWOOD PARK - ADMIN & MAINTENANCE', '57', '', '', ''),
    ('CSBP LIMITED GERALDTON', '56', '', '', ''),
    ('PMR - WA PREMIX BAYSWATER', '56', '', '', ''),
    ('SILVER LAKE MAXWELLS PIT', '56', '', '', ''),
    ('SWAN TRANSIT BEENYUP', '56', '', '', ''),
    ('TANK UG - SINGLE', '56', '', '', ''),
    ('SILVER LAKE (ROTHSAY) VAULT', '55', '', '', ''),
    ('AU AIRPT ESPERANCE', '54', '', '', ''),
    ('Ed Dept. Denmark -Sth Coast Hwy 580', '54', '', '', ''),
    ('SILVER LAKE DAISY WORKSHOP', '54', '', '', ''),
    ('PRIXCAR FORRESTDALE M/S 5KL', '52', '', '', ''),
    ('QUBE PORTS-CLARK C60D FORKLIFT', '52', '', '', ''),
    ('SANZONE BULLSBROOK BULK TANK', '52', '', '', ''),
    ('SWAN TRANSIT ALKIMOS', '52', '', '', ''),
    ('VEOLIA R&R BIBRA LAKE 11,495L TANK', '52', '', '', ''),
    ('AU AIRPT CARNARVON', '50', '', '', ''),
    ('EMRC - BAYS WASTE', '50', '', '', ''),
    ('SKIPPERS AIR BULK DEL THUNDERBOX', '50', '', '', ''),
    ('WESTERN POWER - ALBANY', '50', '', '', ''),
    ('BGC MIDDLE SWAN MASONRY TANK', '48', '', '', ''),
    ('EDNA MAY MINE BORE FIELD TANKS', '48', '', '', ''),
    ('SWAN TRANSIT MIDVALE', '48', '', '', ''),
    ('AU AIRPT MEEKATHARRA', '46', '', '', ''),
    ('DEC Dwellingup Dwellingup', '46', '', '', ''),
    ('SOUTH32 WORSLEY WELLINGTON DAM 30KL', '46', '', '', ''),
    ('ST IVES NEPTUNE (S067)', '46', '', '', ''),
    ('SWAN TRANSIT SOUTHERN RIVER', '46', '', '', ''),
    ('AU AIRPT ALBANY', '44', '', '', ''),
    ('GEOGRAPHE EARTHMOVING ALCOA KWINANA', '44', '', '', ''),
    ('ST IVES ARGO', '44', '', '', ''),
    ('ST IVES ATHENA (S064)', '44', '', '', ''),
    ('WESTERN POWER - KONDININ', '44', '', '', ''),
    ('WESTERN POWER - MERREDIN DEPOT', '44', '', '', ''),
    ('WESTERN POWER - STIRLING', '44', '', '', ''),
    ('AURIZON INTERMODAL 10K TANK', '42', '', '', ''),
    ('DEC - JARRADALE', '42', '', '', ''),
    ('FLG - ALBANY CHESTERPASS TANK - NEW', '42', '', '', ''),
    ('KARNET PRISON FARM SERPENTINE', '42', '', '', ''),
    ('ST IVES LEVIATHAN (S062)', '42', '', '', ''),
    ('WESTERN POWER - GERALDTON', '42', '', '', ''),
    ('ZGB - LABOUCHERE ROAD TANKS', '42', '', '', ''),
    ('BARMINCO SPOTTED QUOLL', '40', '', '', ''),
    ('SWAN TRANSIT MT CLAREMONT', '40', '', '', ''),
    ('SYNERGY PINJAR (STEVEMACS)', '40', '', '', ''),
    ('PENSKE HAZELMERE', '38', '', '', ''),
    ('PRIXCAR PERTH - ULTIMATE 98', '38', '', '', ''),
    ('WESTERN POWER - MOORA DEPOT', '38', '', '', ''),
    ('AGNEW GATEHOUSE', '37', '', '', ''),
    ('BHP AIR Bulk DEL Mt Keith', '36', '', '', ''),
    ('GKR TRANSPORT - CASINO', '36', '', '', ''),
    ('ST IVES MLG (HAULAGE) (S063)', '36', '', '', ''),
    ('SWAN TRANSIT CANNING VALE', '36', '', '', ''),
    ('SWAN TRANSIT SHENTON PARK', '36', '', '', ''),
    ('TOLEDO AUSCO - FROGS LEGS', '36', '', '', ''),
    ('URBAN RESOURCES SOUTH YUNDERUP', '36', '', '', ''),
    ('WESTERN POWER - NORTHAM', '36', '', '', ''),
    ('WESTERN POWER - PINJARRA', '36', '', '', ''),
    ('AU AIRPT BUNBURY', '34', '', '', ''),
    ('AWR - KWINANA - A25713', '34', '', '', ''),
    ('BGC WANGARA', '34', '', '', ''),
    ('Ed Dept. Cunderdin Agg School 58020', '34', '', '', ''),
    ('PMR - WA LIMESTONE-MILLAR ROAD', '34', '', '', ''),
    ('QUBE LOG (WA) - GENERATOR 1 - G008', '34', '', '', ''),
    ('SYNERGY - CORAL BAY', '34', '', '', ''),
    ('TOLEDO AUSCO - Mill', '34', '', '', ''),
    ('WESTERN POWER - THREE SPRINGS', '34', '', '', ''),
    ('CITY OF SWAN - REG UNLEADED', '33', '', '', ''),
    ('CITY OF ROCKINGHAM - BALDIVIS DISTR', '32', '', '', ''),
    ('GEOGRAPHE EARTHMOVING PINJARRA', '32', '', '', ''),
    ('MERREDIN ENERGY EX KEWDALE', '32', '', '', ''),
    ('ST IVES INV STH (WEIGHBRIDGE) S060', '32', '', '', ''),
    ('ST IVES REVENGE (S066)', '32', '', '', ''),
    ('BARTO GOLD MARVEL LOCH STORE', '30', '', '', ''),
    ('BHP NiW - Kalgoorlie, Kambalda', '30', '', '', ''),
    ('BLK JET DEL Laverton Airport x Kewd', '30', '', '', ''),
    ('CHARLES HULL BODDINGTON DEPOT', '30', '', '', ''),
    ('PRIXCAR PERTH ACS TEMP - DSL', '30', '', '', ''),
    ('BGC NAVAL BASE', '28', '', '', ''),
    ('CITY OF ROCKINGHAM - LARK HILL SPOR', '28', '', '', ''),
    ('Health Dept. Carnarvon; Cleaver st', '28', '', '', ''),
    ('MONDIALE VGL PTY LTD - BIBRA LAKE', '28', '', '', ''),
    ('QUBE LOG (WA) HST002 KALMAR EMPTY', '28', '', '', ''),
    ('SWAN TRANSIT ELLENBROOK', '28', '', '', ''),
    ('T68 SELF BUNDED TANK (BELMONT AVE)', '28', '', '', ''),
    ('WESTERN POWER - JURIEN BAY', '28', '', '', ''),
    ('EDNA MAY TAMPIA', '27', '', '', ''),
    ('DARLOT MINING VAULT LAKE DARLOT', '26', '', '', ''),
    ('EMRC-Wood Recycling Depot Hazelmere', '26', '', '', ''),
    ('GRUYERE AERODROME', '26', '', '', ''),
    ('PRIXCAR FORRESTDALE DSL 70KL', '26', '', '', ''),
    ('QUBE LOG (WA) - GENERATOR 1 - G007', '26', '', '', ''),
    ('QUBE LOG (WA) - KONECRANE SMV- 4618', '26', '', '', ''),
    ('SHARK BAY TOWN TANK DSL', '26', '', '', ''),
    ('TGE KEWDALE', '26', '', '', ''),
    ('CASUARINA PRISON - BULK', '24', '', '', ''),
    ('JAGUAR MINE SITE', '24', '', '', ''),
    ('SILVERLAKE ALDISS CAMP', '24', '', '', ''),
    ('BHP NIW - DYNO TANK MT KEITH', '22', '', '', ''),
    ('HERTZ PERTH AIRPORT', '22', '', '', ''),
    ('HORIZONS WEST - WELSHPOOL', '22', '', '', ''),
    ('SWAN TRANSIT BUNBURY', '22', '', '', ''),
    ('AU AIRPT PERTH', '20', '', '', ''),
    ('FREMANTLE PORT AUTHORITY KWINANA', '20', '', '', ''),
    ('PRIXCAR FORRESTDALE DSL 4KL', '20', '', '', ''),
    ('PRIXCAR PERTH - DIESEL', '20', '', '', ''),
    ('SWAN TRANSIT NOWERGUP', '20', '', '', ''),
    ('VEOLIA R&R BALCATTA 12KL BULK TANK', '20', '', '', ''),
    ('VEOLIA R&R KALGOORLIE 9.9KL BULK', '20', '', '', ''),
    ('AUSDRILL KAMBALDA', '18', '', '', ''),
    ('BANKSIA HILL DETENTION CENTRE', '18', '', '', ''),
    ('BOTANIC GARDENS - KINGS PARK', '18', '', '', ''),
    ('CHARLES HULL WAGERUP EX COOGEE', '18', '', '', ''),
    ('ESPERANCE FREIGHTLINES GERALDTON', '18', '', '', ''),
    ('MT MAGNET GOLD - WATER TANK HILL', '18', '', '', ''),
    ('QUBE KOPPERS WOOD PRODUCTS', '18', '', '', ''),
    ('QUBE PORTS-KALMAR TR618I TERMINAL', '18', '', '', ''),
    ('RECOCHEM - SOLVENT78 DELIVERED', '18', '', '', ''),
    ('Sandalford Wines West Swan via Midl', '18', '', '', ''),
    ('SILVER LAKE (DEFLECTOR) VAULT EX', '18', '', '', ''),
    ('SWAN TRANSIT ALBANY', '18', '', '', ''),
    ('Waverley Forklifts Canning vale', '18', '', '', ''),
    ('KARORA HIGGINSVILLE ATREDES', '17', '', '', ''),
    ('BGC BUSHMEAD RD (PLASTERBOARD)', '16', '', '', ''),
    ('BLK JET DEL Duketon Air Strip', '16', '', '', ''),
    ('DEPT OF PARKS & WILDLIFE-MILYERING', '16', '', '', ''),
    ('SHARK BAY TOWN TANK ULT 98', '16', '', '', ''),
    ('ST IVES LEFROY (S061)', '16', '', '', ''),
    ('WESTERN ENERGY KWINANA', '16', '', '', ''),
    ('WOOROLOO PRISON FARM - BULK', '16', '', '', ''),
    ('WRR WELSHPOOL DIE', '16', '', '', ''),
    ('AGNEW EDL DIESEL', '14', '', '', ''),
    ('BOOTH HOPE VALLEY (VIA STEVEMACS)', '14', '', '', ''),
    ('PMR - CUNDERDIN', '14', '', '', ''),
    ('PMR - WA LIMESTONE-FLYNN DRIVE', '14', '', '', ''),
    ('PMR WA PREMIX CARDUP', '14', '', '', ''),
    ('R BLOCK COURTYARD -  MOORE ST', '14', '', '', ''),
    ('SWAN TRANSIT MUNDARING', '14', '', '', ''),
    ('CLOSED - KUNDANA GOLD - RAYJAX FUEL', '13', '', '', ''),
    ('DEPARTMENT OF PLANNING, LANDS AND', '12', '', '', ''),
    ('ESPERANCE FREIGHTLINES - WELSHPOOL', '12', '', '', ''),
    ('NSR - KANOWNA BELLE MILL SURFACE', '12', '', '', ''),
    ('QUBE BULK Leonora IMT bulk tank', '12', '', '', ''),
    ('SILVERLAKE - PICK UP KALGOORLIE', '12', '', '', ''),
    ('TALISON LITHIUM GREENBUSHES MINE UD', '12', '', '', ''),
    ('VEOLIA R&R BIBRA LAKE 29KL TANK', '12', '', '', ''),
    ('TGE CARNARVON', '11', '', '', ''),
    ('Agriculture WA Katanning 8557748703', '10', '', '', ''),
    ('ALBANY REGIONAL PRISON - BULK', '10', '', '', ''),
    ('AUSDRILL KALGOORLIE', '10', '', '', ''),
    ('HEALTH DEPT. NEDLANDS; HH BLOCK', '10', '', '', ''),
    ('KCGM GIDJI', '10', '', '', ''),
    ('SILVER LAKE ALDISS CAMP', '10', '', '', ''),
    ('THIESS WELSHPOOL WORKSHOP', '10', '', '', ''),
    ('URBAN RESOURCES TWO ROCKS', '10', '', '', ''),
    ('AU AIRPT MANJIMUP', '8', '', '', ''),
    ('COBHAM AVIATION SERVICES AIR BULK', '8', '', '', ''),
    ('DYNO NOBEL - KALGOORLIE - COLUMBIA', '8', '', '', ''),
    ('DYNO NOBEL KALGOORLIE COLUMBIA', '8', '', '', ''),
    ('FSH - Bedbrook Row CTLG', '8', '', '', ''),
    ('FSH - Fiona Wood Rd DG1 CEP', '8', '', '', ''),
    ('Health Dept. Albany; Hardy rd Alban', '8', '', '', ''),
    ('KUNDANA GOLD - RAYJAX FUEL FACILITY', '8', '', '', ''),
    ('SHENTON COLLEGE DSL - APPROX 600 L', '8', '', '', ''),
    ('SILVERLAKE - DAISY GAS POWER GEN', '8', '', '', ''),
    ('SILVERLAKE DAISY GAS POWER GEN', '8', '', '', ''),
    ('SOUTH32 BBM MARRADONG FULL', '8', '', '', ''),
    ('SWAN TRANSIT KALGOORLIE', '8', '', '', ''),
    ('TALISON LITHIUM - UD - CATALANO TAN', '8', '', '', ''),
    ('DYNO NOBEL KALGOORLIE JUBILEE', '6', '', '', ''),
    ('GEOGRAPHE EARTHMOVING WAGERUP', '6', '', '', ''),
    ('HOLCIM ALBANY WA CONCRETE OSR', '6', '', '', ''),
    ('HOLCIM ALBANY WA QUARRY', '6', '', '', ''),
    ('HORIZONS WEST - LANDSDALE', '6', '', '', ''),
    ('Jundee Mine -NJE Bulk', '6', '', '', ''),
    ('KCGM MT CHARLOTTE MINE SAM', '6', '', '', ''),
    ('KING EDWARD MEMORIAL HOSPITAL', '6', '', '', ''),
    ('PTA EAST PERTH - NEW 2025 - TANK 1', '6', '', '', ''),
    ('Q BLOCK � OFF WELLINGTON ST', '6', '', '', ''),
    ('WRR BOULDER BULK TANK', '6', '', '', ''),
    ('AWR DIL AVON YARD', '4', '', '', ''),
    ('BARMINCO HAZELMERE', '4', '', '', ''),
    ('BGC JOONDALUP', '4', '', '', ''),
    ('CITY OF GOSNELLS - MAIN DEPOT - ULP', '4', '', '', ''),
    ('CPB - WELSHPOOL', '4', '', '', ''),
    ('DEPARTMENT OF PRIMARY INDUSTRIES', '4', '', '', ''),
    ('EDNA MAY DIE HARDY', '4', '', '', ''),
    ('HERTZ - PERTH AIRPORT', '4', '', '', ''),
    ('HOLCIM KALCRUSH WA CRUSHING', '4', '', '', ''),
    ('INDEPENDENCENOVA AIR Bulk DEL NOVA', '4', '', '', ''),
    ('Jundee Mine � NJE Bulk', '4', '', '', ''),
    ('Main Roads Dongara Tank-CUAFUEL2021', '4', '', '', ''),
    ('PEEL HEALTH CAMPUS', '4', '', '', ''),
    ('QUBE LOG (WA) - KONECRANE SMV - 468', '4', '', '', ''),
    ('SHENTON COLLEGE ULP - APPROX 600 L', '4', '', '', ''),
    ('SILVER LAKE DAISY GAS POWER GEN', '4', '', '', ''),
    ('SILVERLAKE PICK UP KALGOORLIE', '4', '', '', ''),
    ('ST IVES HAMLET (ARGO) (S065)', '4', '', '', ''),
    ('SYNERGY - BREMER BAY', '4', '', '', ''),
    ('TOLEDO AUSCO - PARADIGM SURFACE', '4', '', '', ''),
    ('B & J CATALANO - KUKERIN', '2', '', '', ''),
    ('BGC MAGNET RD CANNING VALE', '2', '', '', ''),
    ('BIG BELL GOLD - PADDYS FLAT (MULTI', '2', '', '', ''),
    ('BISHOPS CARNARVON (SINGLE DROP LOAD', '2', '', '', ''),
    ('BLACK SWAN NICKEL', '2', '', '', ''),
    ('BOOTH HOPE VALLEY TOLL', '2', '', '', ''),
    ('C- T68 SELF BUNDED TK (BELMONT AVE)', '2', '', '', ''),
    ('CLOSED - KUNDANA GOLD - MLG SURFACE', '2', '', '', ''),
    ('CLOSED TOLEDO AUSCO - PARADIGM', '2', '', '', ''),
    ('EDL - LEONORA', '2', '', '', ''),
    ('HEALTH DEPARTMENT - GRAYLANDS', '2', '', '', ''),
    ('Health Dept. Fremantle; Atfield st', '2', '', '', ''),
    ('HEALTH DEPT. PERTH CHILDRENS', '2', '', '', ''),
    ('HOLCIM GERALDTON WA CONCRETE', '2', '', '', ''),
    ('KCGM MT CHARLOTTE MINE FIM UG', '2', '', '', ''),
    ('MONDIALE VGL PTY LTD - JANDAKOT', '2', '', '', ''),
    ('NSR - STH KALG - UG POWER SURFACE', '2', '', '', ''),
    ('OSBORNE PARK HOSPITAL U/G TANK', '2', '', '', ''),
    ('PTA EAST PERTH - EMERGENCY GEN', '2', '', '', ''),
    ('QUBE LOG (WA) - ROUS HEAD DEPOT', '2', '', '', ''),
    ('QUBE LOG (WA) - RST007', '2', '', '', ''),
    ('SHENTON COLLEGE ULP - APPROX 1200 L', '2', '', '', ''),
    ('SILVERLAKE COCK EYED BOB MAIL TAN', '2', '', '', ''),
    ('URBAN RESOURCES DAWESVILLE', '2', '', '', ''),
    ('WESTERN POWER - KALBARRI TEMP', '2', '', '', ''),
    ('WRR WELSHPOOL - DIRECT EQUIP', '2', '', '', '');

  RAISE NOTICE 'Inserted % rows into temporary table', (SELECT COUNT(*) FROM temp_customer_import);
  
  -- Debug: Show sample of data to be processed
  RAISE NOTICE 'Sample of customers to import:';
  FOR customer_rec IN 
    SELECT customer_name, latitude, longitude, transaction_count
    FROM temp_customer_import 
    WHERE customer_name IS NOT NULL AND customer_name != ''
    LIMIT 3
  LOOP
    RAISE NOTICE '  - %: lat=%, lng=%, trans=%', customer_rec.customer_name, customer_rec.latitude, customer_rec.longitude, customer_rec.transaction_count;
  END LOOP;
  
  -- Process each customer record
  FOR customer_rec IN 
    SELECT 
      customer_name,
      CASE WHEN transaction_count ~ '^[0-9]+$' THEN transaction_count::INTEGER ELSE 0 END as trans_count,
      location_name,
      CASE WHEN latitude != '' AND latitude ~ '^-?[0-9]+\.?[0-9]*$' THEN latitude::DECIMAL(10,8) ELSE NULL END as lat,
      CASE WHEN longitude != '' AND longitude ~ '^-?[0-9]+\.?[0-9]*$' THEN longitude::DECIMAL(11,8) ELSE NULL END as lng
    FROM temp_customer_import
    WHERE customer_name IS NOT NULL AND customer_name != ''
  LOOP
    BEGIN
      -- Note if missing coordinates but continue with import
      IF customer_rec.lat IS NULL OR customer_rec.lng IS NULL THEN
        RAISE NOTICE 'Importing % without coordinates - GPS can be added later', customer_rec.customer_name;
      END IF;
      
      -- Calculate data quality score
      DECLARE
        quality_score DECIMAL(3,2) := 1.0;
      BEGIN
        -- Reduce quality if location name is empty
        IF customer_rec.location_name IS NULL OR customer_rec.location_name = '' THEN
          quality_score := quality_score - 0.1;
        END IF;
        
        -- Reduce quality if transaction count is very low
        IF customer_rec.trans_count < 10 THEN
          quality_score := quality_score - 0.2;
        END IF;
        
        -- Reduce quality if coordinates are missing
        IF customer_rec.lat IS NULL OR customer_rec.lng IS NULL THEN
          quality_score := quality_score - 0.4;
        -- Check if coordinates are reasonable for Western Australia
        ELSIF customer_rec.lat < -45 OR customer_rec.lat > -10 OR customer_rec.lng < 110 OR customer_rec.lng > 155 THEN
          quality_score := quality_score - 0.3;
        END IF;
        
        -- Ensure minimum quality
        quality_score := GREATEST(quality_score, 0.3);
      END;
      
      -- Insert customer location
      INSERT INTO customer_locations (
        customer_name,
        location_name,
        latitude,
        longitude,
        transaction_count,
        data_quality_score,
        geocoding_accuracy,
        batch_id,
        primary_carrier,
        avg_monthly_volume_litres,
        priority_level,
        data_source
      ) VALUES (
        customer_rec.customer_name,
        NULLIF(customer_rec.location_name, ''),
        customer_rec.lat,
        customer_rec.lng,
        customer_rec.trans_count,
        quality_score,
        CASE 
          WHEN customer_rec.lat IS NOT NULL AND customer_rec.lng IS NOT NULL THEN 'exact'
          ELSE 'missing'
        END, -- Mark accuracy as exact for valid coordinates, missing for NULL
        batch_id,
        CASE 
          WHEN customer_rec.trans_count >= 1000 THEN 'Combined'
          WHEN customer_rec.trans_count >= 500 THEN 'SMB'
          ELSE 'GSF'
        END,
        customer_rec.trans_count * 2500, -- Estimate ~2500L per transaction
        CASE 
          WHEN customer_rec.trans_count >= 2000 THEN 1  -- Highest priority
          WHEN customer_rec.trans_count >= 1000 THEN 2
          WHEN customer_rec.trans_count >= 500 THEN 3
          WHEN customer_rec.trans_count >= 200 THEN 4
          WHEN customer_rec.trans_count >= 50 THEN 5   -- Medium priority
          WHEN customer_rec.trans_count >= 20 THEN 6
          WHEN customer_rec.trans_count >= 10 THEN 7
          WHEN customer_rec.trans_count >= 5 THEN 8
          ELSE 9                                      -- Lower priority
        END,
        'CSV Import Take 1'
      );
      
      imported_count := imported_count + 1;
      
      -- Progress reporting every 50 customers
      IF imported_count % 50 = 0 THEN
        RAISE NOTICE 'Progress: Imported % customers so far...', imported_count;
      END IF;
      
      -- Count BP customers
      IF LOWER(customer_rec.customer_name) LIKE '%bp %' 
         OR LOWER(customer_rec.customer_name) LIKE 'bp %'
         OR LOWER(customer_rec.customer_name) LIKE '% bp'
         OR LOWER(customer_rec.customer_name) = 'bp' THEN
        bp_customer_count := bp_customer_count + 1;
      END IF;
      
    EXCEPTION
      WHEN unique_violation THEN
        error_count := error_count + 1;
        RAISE NOTICE 'UNIQUE VIOLATION: Customer % already exists - skipping', customer_rec.customer_name;
      WHEN check_violation THEN
        error_count := error_count + 1;
        RAISE NOTICE 'CHECK CONSTRAINT VIOLATION: Customer % failed constraint check: %', customer_rec.customer_name, SQLERRM;
      WHEN not_null_violation THEN
        error_count := error_count + 1;
        RAISE NOTICE 'NOT NULL VIOLATION: Customer % missing required field: %', customer_rec.customer_name, SQLERRM;
      WHEN foreign_key_violation THEN
        error_count := error_count + 1;
        RAISE NOTICE 'FOREIGN KEY VIOLATION: Customer % has invalid reference: %', customer_rec.customer_name, SQLERRM;
      WHEN OTHERS THEN
        error_count := error_count + 1;
        RAISE NOTICE 'UNEXPECTED ERROR importing customer %: SQLSTATE=%, Message=%', customer_rec.customer_name, SQLSTATE, SQLERRM;
        RAISE NOTICE 'Customer data: name=%, lat=%, lng=%, trans=%', customer_rec.customer_name, customer_rec.lat, customer_rec.lng, customer_rec.trans_count;
    END;
  END LOOP;
  
  -- Clean up temporary table
  DROP TABLE temp_customer_import;
  
  -- Refresh analytics
  PERFORM refresh_customer_analytics();
  
  -- Final summary
  RAISE NOTICE '=== CUSTOMER LOCATIONS IMPORT COMPLETE ===';
  RAISE NOTICE 'Import Batch ID: %', batch_id;
  RAISE NOTICE 'Successfully imported: % customers', imported_count;
  RAISE NOTICE 'Skipped (missing coordinates): %', skipped_count;
  RAISE NOTICE 'Errors encountered: %', error_count;
  RAISE NOTICE 'BP customers identified: %', bp_customer_count;
  RAISE NOTICE 'Total customers in database: %', (SELECT COUNT(*) FROM customer_locations);
  RAISE NOTICE 'BP customers percentage: %', 
    ROUND((bp_customer_count::DECIMAL / GREATEST(imported_count, 1)) * 100, 1);
  
  -- Display BP customers found
  RAISE NOTICE 'BP customers imported:';
  FOR bp_rec IN 
    SELECT customer_name, transaction_count, contract_type 
    FROM customer_locations 
    WHERE is_bp_customer = TRUE AND import_batch_id = batch_id
    ORDER BY transaction_count DESC
  LOOP
    RAISE NOTICE '  - %: % transactions (% contract)', 
      bp_rec.customer_name, bp_rec.transaction_count, bp_rec.contract_type;
  END LOOP;
  
  -- Display regional distribution
  RAISE NOTICE 'Regional distribution:';
  FOR region_rec IN 
    SELECT region, COUNT(*) as count
    FROM customer_locations 
    WHERE import_batch_id = batch_id
    GROUP BY region 
    ORDER BY count DESC
  LOOP
    RAISE NOTICE '  - %: % customers', region_rec.region, region_rec.count;
  END LOOP;
  
  -- Display customer type distribution
  RAISE NOTICE 'Customer type distribution:';
  FOR type_rec IN 
    SELECT customer_type, COUNT(*) as count
    FROM customer_locations 
    WHERE import_batch_id = batch_id
    GROUP BY customer_type 
    ORDER BY count DESC
  LOOP
    RAISE NOTICE '  - %: % customers', type_rec.customer_type, type_rec.count;
  END LOOP;
  
  -- Final verification check
  RAISE NOTICE 'Final verification: % customers currently in table', (SELECT COUNT(*) FROM customer_locations WHERE import_batch_id = batch_id);
  
  -- If no customers were imported, something went wrong
  IF imported_count = 0 THEN
    RAISE EXCEPTION 'IMPORT FAILED: No customers were imported. Check error messages above.';
  END IF;
  
END $$;

-- Explicit commit - this is critical!
COMMIT;

RAISE NOTICE 'Transaction committed successfully. Import complete.';

-- Verify import success
SELECT 
  'Customer Locations Import Summary' as report_type,
  COUNT(*) as total_customers,
  COUNT(*) FILTER (WHERE is_bp_customer = TRUE) as bp_customers,
  COUNT(DISTINCT region) as regions_covered,
  COUNT(DISTINCT customer_type) as customer_types,
  AVG(transaction_count) as avg_transaction_count,
  SUM(transaction_count) as total_transactions,
  MIN(data_quality_score) as min_quality_score,
  AVG(data_quality_score) as avg_quality_score
FROM customer_locations
WHERE data_source LIKE '%CSV Import%';

-- Show top customers by transaction volume
SELECT 
  'Top 10 Customers by Transaction Volume' as report_type,
  customer_name,
  transaction_count,
  customer_type,
  is_bp_customer,
  region,
  contract_type
FROM customer_locations
WHERE data_source LIKE '%CSV Import%'
ORDER BY transaction_count DESC
LIMIT 10;

SELECT 'Customer locations CSV import completed successfully' as result;