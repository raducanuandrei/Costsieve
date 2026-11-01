# Interfața și animațiile — etapa următoare

Repo-ul principal este Costsieve, independent de Lovable. Nu conecta aplicația GitHub Lovable, Git sync sau un plugin Lovable de build/runtime. Interfața se transferă manual și se conectează la API-ul din browser-integration.md; formulele rămân în motor.

Respectă fluxul documente -> verificare -> raport -> recomandări/scenarii -> ghiduri/export. Folosește demo sintetic etichetat, nu metrici inventate. Recomandările necunoscute nu primesc economii optimiste implicite.

Cerința proprietarului: verde pentru rezultat pozitiv/economii, roșu pentru pierderi sau efect negativ confirmat, și prezentare clară a cât ar putea câștiga din schimbările selectate. Cheltuielile obișnuite nu sunt etichetate automat drept pierdere.

După conectarea calculelor:

- Animații scurte, 150–250 ms, pentru diferența dintre scenariul inițial și cel selectat. Fără contor public de bani economisiți neverificați.
- Semne +/−, text și etichete pe lângă culoare. Pentru proiecții: „Economie potențială”, „Estimare” și perioada; pentru rezultat: „pe baza datelor furnizate”, cu ipoteza veniturilor constante.
- Când costul implementării depășește reducerea, arată efectul net negativ în roșu; nu îl ascunde și nu îl limitează artificial la zero.
- Respectă prefers-reduced-motion și păstrează valoarea accesibilă cititoarelor de ecran stabilă în timp ce reprezentarea vizuală se actualizează.
- Buton „Cum implementez?” lângă fiecare recomandare, folosind ghidul versionat din motor.
- Secțiune Sponsor us și pagină Support neblocante, fără paywall sau întreruperea analizei. Linkul real de sponsorizare va fi furnizat de proprietar.

Aceste animații și interfața publică nu sunt declarate implementate de livrarea motorului/MCP. Testează fluxul real, contrastul, tastatura, mobilul, lipsa scurgerilor în rețea și resetarea după integrare.
