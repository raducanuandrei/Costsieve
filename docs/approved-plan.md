# CostSieve: adaugi datele, primești un plan de economisire

## Experiența utilizatorului

CostSieve rămâne gratuit, open source și fără cont obligatoriu. Fluxul principal are trei pași:

1. **Adaugi documentele:** CSV, Excel `.xlsx`, facturi PDF, scanări sau fotografii JPG/PNG.
2. **Verifici datele extrase:** confirmi sumele și corectezi doar informațiile lipsă sau ambigue.
3. **Primești recomandări:** ce merită verificat, ce poți schimba și impactul estimat. Alegi schimbările potrivite, iar rezultatul se recalculează.

Raportul inițial apare înaintea întrebărilor despre utilizare și contracte. Prima rafinare cere cel mult **trei clarificări relevante**; detaliile suplimentare rămân opționale, lângă recomandări.

## Import și analiză

- Păstrăm motorul existent. Adăugăm citire Excel cu `read-excel-file`, extragere PDF cu PDF.js și recunoaștere locală a textului cu Tesseract.js. Pentru PDF scanat, paginile sunt transformate întâi în imagini. [Excel](https://github.com/catamphetamine/read-excel-file) · [OCR](https://github.com/naptha/tesseract.js)
- Extragerea începe cu engleză și română. Lucrăm cu valorile existente în Excel, fără executarea formulelor, macrocomenzilor sau legăturilor externe. Fișierele `.xls`, `.xlsm` și documentele protejate prin parolă primesc instrucțiuni de conversie.
- La facturi, utilizatorul confirmă furnizorul, data, moneda, totalul și dacă reprezintă o achiziție sau o vânzare. Subtotalul, TVA-ul și totalul nu sunt adunate între ele. Valorile nesigure rămân neconfirmate.
- Dacă factura și plata ei apar în documente diferite, propunem asocierea lor și cerem confirmare. **Eliminarea unei dublări din import nu este prezentată drept economie pentru business.**
- Procesăm documentele pe dispozitiv, cu progres și anulare. Limite inițiale: 20 MiB/fișier, 50 MiB și 20 fișiere/analiză, 100.000 de înregistrări, 20 pagini/PDF și 50 pagini OCR/analiză. Imaginile sunt limitate la 20 megapixeli; procesarea OCR este secvențială, cu maximum 120 secunde/pagină. Depășirile produc explicații, fără trunchiere ascunsă.

## Recomandări și impact financiar

Fiecare recomandare conține:

- **Ce am observat**, cu trimitere la documentele relevante.
- **Ce poți schimba** și ce informații mai trebuie confirmate.
- **Economia estimată**, perioada și ipotezele folosite.
- **Cum implementezi**, cu pași scurți, condiții contractuale și verificarea rezultatului.

Începem cu plăți posibil duplicate, abonamente recurente, licențe nefolosite confirmate și furnizorii care concentrează cheltuielile. O cheltuială mare nu devine automat „risipă”. Nu inventăm prețuri alternative sau reduceri negociabile.

Din cheltuieli arătăm **economii potențiale**. Cu venituri pentru aceeași perioadă și monedă, arătăm și rezultatul înregistrat înainte/după schimbările selectate, presupunând venituri constante și scăzând costurile declarate ale implementării. Nu îl numim profit contabil verificat.

Pentru interfața simplă, recomandările suprapuse sunt alternative: utilizatorul nu poate selecta simultan două schimbări asupra aceleiași cheltuieli. Estimările lunare din abonamente nu sunt adunate peste economii istorice pentru aceleași costuri.

## Motor comun și MCP local

- Adăugăm înregistrări cu identificator unic și proveniență pe document/pagină/rând. Păstrăm compatibilitatea cu importul CSV și interfața actuală.
- Introducem propuneri de acțiune cu înregistrări țintă, monedă, perioadă, ipoteze și conflicte explicite. Noul simulator folosește aceste ținte precise, nu întregul furnizor.
- MCP local expune șase operații: pregătirea importului, confirmarea și analiza, simularea schimbărilor, ghidul unei acțiuni, exportul raportului și ștergerea sesiunii. Folosește același motor ca site-ul. [MCP](https://modelcontextprotocol.io/docs/learn/architecture)
- Accesul la fișiere este limitat la directoarele aprobate la pornire. Blocăm ieșirea prin căi relative sau legături simbolice. Nu există operații de anulare a abonamentelor, plată sau modificare a documentelor.
- Datele rămân în memorie, cu expirare după 30 minute de inactivitate. MCP returnează rezumate și informațiile necesare clarificărilor, fără text OCR brut. Aplicația agentului poate trimite răspunsurile primite propriului furnizor AI; explicăm această diferență la configurare.

## Verificare și livrare

- Păstrăm cele 30 de teste existente și adăugăm cazuri pentru Excel, OCR greșit, documente deteriorate, corectări, asocierea factură–plată, monede și acțiuni incompatibile.
- Verificăm aceleași rezultate prin motor, site și MCP; testăm accesul la fișiere, exporturile, anularea și expirarea sesiunii.
- În browser verificăm că documentele nu pleacă prin rețea și că fluxul funcționează pe mobil și cu tastatura.
- Ordinea implementării: **importuri și verificare → recomandări și ghiduri → MCP local → integrarea interfeței Lovable**.
- Lucrăm în repo-ul independent **Costsieve**, fără acces sau sincronizare Lovable. Interfața se transferă manual. Sponsorizarea rămâne voluntară, separată de analiză; nu introducem servicii AI plătite sau MCP online în această versiune.
