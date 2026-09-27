# Zerdeli Urpaq · 2026

3–4 сынып оқушыларынан құралған мектеп командасын тіркеуге арналған Next.js жобасы. Public бетте мектеп, сынып жетекшісі және 10 оқушы енгізіледі. Өтінім Google Sheets-ке бір жол болып жазылады. Қорғалған `/admin` бетінде өтінімдер, курс сатып алушылары, облыс/аудан статистикасы және тіркелу баптаулары басқарылады. Public бетте әкімші панеліне сілтеме көрсетілмейді.

## Талаптар

- Node.js 20.11 немесе жаңарақ нұсқа
- Google Cloud service account
- Google Sheets API қосылған Google Cloud жобасы
- Google Spreadsheet ішінде `Registrations`, `Purchases` және `Settings` парақтары

## Орнату

```bash
npm ci
```

`package-lock.json` арқылы таза, қайталанатын орнату үшін `npm ci` қолданылады. Бастапқы анықтамалықтар `data/source/` папкасында сақталады. Импортёр дәл мына 11 `.xls` файл атауын күтеді:

- `oblys.xls`
- `audan.xls`
- `websql_query_result_2026_9_26_2 (1).xls`
- `websql_query_result_2026_9_26_24.xls`
- `websql_query_result_2026_9_26_12.xls`
- `websql_query_result_2026_9_26_36.xls`
- `websql_query_result_2026_9_26_17.xls`
- `websql_query_result_2026_9_26_3.xls`
- `websql_query_result_2026_9_26_52.xls`
- `websql_query_result_2026_9_26_37 (1).xls`
- `websql_query_result_2026_9_26_16 (1).xls`

Файлдар `.xls` деп аталғанымен, импортёр оларды UTF‑8 HTML table ретінде оқиды. Атауларында бос орын мен жақша болуы мүмкін — оларды өзгертпеңіз. Жетіспейтін/артық `.xls`, күтпеген table/header схемасы немесе қайталанған source файл болса, команда қате беріп тоқтайды.

```bash
npm run prepare:data
```

Команда `src/generated/` ішінде облыстарды, аудандарды, облыс бойынша бөлінген мектеп JSON файлдарын, manifest және `data-import-report.json` есебін жасайды. Бұл артефактілерді қолмен өңдемеңіз: команда `dev` және `build` алдында автоматты түрде қайта жасайды.

## Google Cloud және Spreadsheet

1. Google Cloud Console ішінде жоба жасаңыз.
2. **Google Sheets API** қызметін қосыңыз.
3. Service account жасаңыз және JSON кілтін жүктеп алыңыз.
4. Google Spreadsheet жасаңыз.
5. Spreadsheet-ті service account email мекенжайына **Editor** ретінде бөлісіңіз.
6. `.env.example` файлын `.env.local` деп көшіріп, нақты мәндерді толтырыңыз.

```dotenv
GOOGLE_SHEETS_SPREADSHEET_ID=spreadsheet-id
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_REGISTRATIONS_TAB=Registrations
GOOGLE_SHEETS_PURCHASES_TAB=Purchases
GOOGLE_SHEETS_SETTINGS_TAB=Settings
SESSION_SECRET=кемінде-32-кездейсоқ-таңба
ADMIN_USERS_JSON='[{"email":"admin@example.kz","passwordHash":"$2b$12$..."}]'
APP_ORIGIN=https://registration.example.kz
```

`GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `SESSION_SECRET` және `ADMIN_USERS_JSON` міндетті. Үш sheet атауы көрсетілмесе, `Registrations`/`Purchases`/`Settings` қолданылады. `APP_ORIGIN` custom production domain үшін ұсынылады; соңына `/` қоспаңыз.

`GOOGLE_PRIVATE_KEY` бір жолда сақталса, нақты жол ауыстырулары `\n` түрінде жазылуы керек. `BEGIN PRIVATE KEY` және `END PRIVATE KEY` бөліктерін алып тастамаңыз. Vercel Environment Variables ішінде raw мәнді енгізіңіз; `.env.local` мысалындағы сыртқы тырнақшаларды көшірмеңіз.

Spreadsheet құрылымын қауіпсіз дайындау:

```bash
npm run init:sheets
```

Скрипт жоқ парақтарды жасайды, бос `Registrations` парағына нақты 30 бағанды header, бос `Purchases` парағына 10 бағанды header жазады және бос `Settings` парағына бастапқы мәндерді қосады. Ол бар деректі өшірмейді: header-де жетіспейтін/артық баған болса, Settings keys толық сәйкес болмаса немесе парақ атаулары қайталанса, қате беріп тоқтайды. Команданы Vercel build ішінде емес, `.env.local` толтырылған сенімді терминалда бір рет іске қосыңыз.

## Әкімші құпиясөзі

Құпиясөздің bcrypt hash мәнін интерактивті терминалда жасаңыз:

```bash
npm run admin:hash-password
```

Команда құпиясөзді көрсетпей екі рет сұрайды, кемінде 10 таңба және bcrypt үшін ең көбі 72 UTF‑8 байт талап етеді. Шыққан hash мәнін `ADMIN_USERS_JSON` ішіне салыңыз. Plain-text құпиясөзді `.env.local`, код немесе Google Sheets ішінде сақтамаңыз. Бірнеше әкімші үшін JSON массивіне бірнеше объект қосуға болады.

## Іске қосу

```bash
npm run dev
```

- Public бет: `http://localhost:3000`
- Әкімші кіруі: `http://localhost:3000/admin/login`
- Әкімші панелі: `http://localhost:3000/admin`

`Сатып алғандар` бөлімі `Registrations` парағындағы өтінімдерден автоматты түрде құрылады: әр тіркелген өтінім курс сатып алған бір топ болып есептеледі. Бір топ 10 адамға қолжетімділік береді. Панель сатып алған топтар мен қолжетімді адамдар санын бөлек көрсетіп, қай облыс пен ауданнан көп сатып алынғанын салыстырады. Деректерді екінші рет енгізу қажет емес.

Тексеру командалары:

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

Local production тексеруі үшін алдымен `npm run build`, содан кейін `npm start` орындаңыз. `start` source импортын немесе build-ті өзі іске қоспайды.

## Vercel-ге жариялау

1. Репозиторийді Vercel жобасына қосыңыз; егер monorepo болмаса, Root Directory-ді репозиторий түбірінде қалдырыңыз.
2. Framework Preset: **Next.js**. Install Command: `npm ci`. Build Command: `npm run build`. Output Directory-ді қолмен өзгертпеңіз.
3. Node.js нұсқасы `package.json` талабы бойынша кемінде 20.11 болуы керек.
4. `data/source/` ішіндегі барлық 11 бастапқы файл репозиторийге қосылғанын тексеріңіз; build олардан `src/generated/` артефактілерін қайта жасайды.
5. Міндетті бес server-only айнымалыны Production және қажет болса Preview environment-теріне енгізіңіз. Sheet атаулары optional. Custom production domain қолданылса, Production үшін `APP_ORIGIN` мәнін сол origin-ге қойыңыз. Vercel беретін `VERCEL_URL`, `VERCEL_BRANCH_URL` және `VERCEL_PROJECT_PRODUCTION_URL` айнымалыларын өзіңіз жасамаңыз.
6. Service account email-інің Spreadsheet-ке Editor рұқсаты барын қайта тексеріңіз және deployment алдында `npm run init:sheets` командасын сенімді ортадан бір рет орындаңыз.
7. Environment variable өзгергеннен кейін қайта deploy жасаңыз.

`GOOGLE_*`, `ADMIN_USERS_JSON` және `SESSION_SECRET` айнымалыларына `NEXT_PUBLIC_` префиксін қоспаңыз. Олар браузер bundle-іне түспеуі керек.

Public және admin mutation route-тары Origin тексеруін, request-size шегін және қысқа rate limit қолданады. Жоба дерекқор қолданбайтындықтан, login rate limit бір server instance шегінде жұмыс істейді. Production-та Vercel Firewall/WAF арқылы `/api/admin/login` және `/api/registrations` үшін қосымша edge rate limit орнату ұсынылады.

## Google private key қатесі

`invalid_grant`, `DECODER routines` немесе `Invalid PEM formatted message` қатесі шықса:

1. `GOOGLE_SERVICE_ACCOUNT_EMAIL` кілт алынған service account-қа тиесілі екенін тексеріңіз.
2. Private key толық көшірілгенін тексеріңіз.
3. Environment variable ішінде нақты көпжолды key қолдансаңыз, оны тырнақшаға алыңыз; бір жол қолдансаңыз, жол ауыстыруларын `\n` түрінде қалдырыңыз.
4. Ескі немесе жойылған кілт болса, Google Cloud-та жаңасын жасап, Vercel айнымалысын жаңартыңыз.
5. Spreadsheet ID URL ішіндегі `/d/` және `/edit` арасындағы мән екенін тексеріңіз.

## Қауіпсіздік ескертпелері

- Google API тек server route арқылы қолданылады.
- Google Sheets append операциясы `valueInputOption: RAW` қолданады және formula injection префикстерін бейтараптайды.
- Admin session `httpOnly`, `SameSite=Strict`; production-та `Secure` cookie.
- Admin API жауаптары `Cache-Control: no-store` қолданады.
- Толық телефондар мен request body логқа жазылмайды.
- Public жауап 10 оқушының деректерін қайтармайды.
