const { createApp, ref, computed, onMounted } = Vue;

createApp({
  setup() {
    const gameState = ref('setup');
    const players = ref(['Георги', 'Мария', 'Иван']);
    const newPlayerName = ref('');
    const impostorCount = ref(1);
    const selectedCategory = ref('all');
    const categories = ref([]);
    const wordsList = ref([]);

    const currentPlayerIndex = ref(0);
    const isHolding = ref(false);
    const assignedRoles = ref([]);
    const startingPlayer = ref('');

    const showAdminModal = ref(false);
    const isAdmin = ref(false);
    const adminEmail = ref('');
    const adminPassword = ref('');
    const newCategoryName = ref('');
    const addWordCategoryId = ref('');
    const newOriginalWord = ref('');
    const newImpostorHint = ref('');

    // AI Генератор и масово добавяне променливи
    const aiTopicInput = ref('');
    const isGenerating = ref(false);
    const adminTab = ref('single');
    const bulkWordsText = ref('');

    const fetchData = async () => {
      const { data: catData } = await supabaseClient.from('categories').select('*');
      if (catData) categories.value = catData;

      const { data: wordData } = await supabaseClient.from('words').select('*');
      if (wordData) wordsList.value = wordData;
    };

    onMounted(async () => {
      await fetchData();
      const { data: { user } } = await supabaseClient.auth.getUser();
      isAdmin.value = !!user;
    });

    const addPlayer = () => {
      if (newPlayerName.value.trim()) {
        players.value.push(newPlayerName.value.trim());
        newPlayerName.value = '';
      }
    };

    const removePlayer = (index) => {
      players.value.splice(index, 1);
      if (impostorCount.value >= players.value.length) {
        impostorCount.value = Math.max(1, players.value.length - 1);
      }
    };

    const currentTurnPlayer = computed(() => players.value[currentPlayerIndex.value]);

    const startGame = () => {
      if (players.value.length < 3) return;

      let pool = wordsList.value;
      if (selectedCategory.value !== 'all') {
        pool = pool.filter(w => w.category_id === selectedCategory.value);
      }

      if (pool.length === 0) {
        alert('Няма налични думи в тази категория! Добавете през админ панела.');
        return;
      }

      const randomWordObj = pool[Math.floor(Math.random() * pool.length)];

      const total = players.value.length;
      const impostorIndexes = new Set();
      while (impostorIndexes.size < impostorCount.value) {
        impostorIndexes.add(Math.floor(Math.random() * total));
      }

      assignedRoles.value = players.value.map((player, idx) => {
        const isImp = impostorIndexes.has(idx);
        // Ако няма въведена подсказка в базата, слагаме оригиналната дума като fallback
        const hintText = randomWordObj.impostor_hint || randomWordObj.original_word;
        return {
          player,
          isImpostor: isImp,
          word: isImp ? hintText : randomWordObj.original_word
        };
      });

      currentPlayerIndex.value = 0;
      gameState.value = 'cards';
    };

    const nextPlayer = () => {
      if (currentPlayerIndex.value < players.value.length - 1) {
        currentPlayerIndex.value++;
      } else {
        startingPlayer.value = players.value[Math.floor(Math.random() * players.value.length)];
        gameState.value = 'play';
      }
    };

    const resetGame = () => {
      gameState.value = 'setup';
    };

    const loginAdmin = async () => {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: adminEmail.value,
        password: adminPassword.value
      });
      if (error) alert('Грешка при вход: ' + error.message);
      else {
        isAdmin.value = true;
        alert('Успешен вход!');
      }
    };

    const logoutAdmin = async () => {
      await supabaseClient.auth.signOut();
      isAdmin.value = false;
    };

    const addCategory = async () => {
      if (!newCategoryName.value.trim()) return;
      const { error } = await supabaseClient.from('categories').insert([{ name: newCategoryName.value.trim() }]);
      if (error) alert(error.message);
      else {
        newCategoryName.value = '';
        fetchData();
      }
    };

    // Помощна функция за проверка за дубликати
    const checkDuplicate = (word, categoryId) => {
      return wordsList.value.some(
        w => w.category_id === categoryId && w.original_word.toLowerCase() === word.toLowerCase()
      );
    };

    // Ръчно добавяне на дума (подсказката вече не е задължителна - ако е празна, ползва оригиналната дума)
    const addWord = async () => {
      if (!addWordCategoryId.value || !newOriginalWord.value.trim()) {
        alert('Моля изберете категория и въведете оригинална дума!');
        return;
      }

      const wordClean = newOriginalWord.value.trim();
      const hintClean = newImpostorHint.value.trim() ? newImpostorHint.value.trim() : wordClean;

      if (checkDuplicate(wordClean, addWordCategoryId.value)) {
        alert(`Думата "${wordClean}" вече съществува в тази категория!`);
        return;
      }

      const { error } = await supabaseClient.from('words').insert([{
        category_id: addWordCategoryId.value,
        original_word: wordClean,
        impostor_hint: hintClean
      }]);

      if (error) alert(error.message);
      else {
        newOriginalWord.value = '';
        newImpostorHint.value = '';
        alert('Думата е добавена успешно!');
        fetchData();
      }
    };

    // Масово добавяне от текст или файл
    const addBulkWords = async () => {
      if (!addWordCategoryId.value || !bulkWordsText.value.trim()) {
        alert('Моля изберете категория и въведете думи!');
        return;
      }

      const lines = bulkWordsText.value.split('\n');
      let addedCount = 0;
      let duplicatesCount = 0;

      for (let line of lines) {
        if (!line.trim()) continue;

        const parts = line.includes('-') ? line.split('-') : line.split(',');
        const original = parts[0] ? parts[0].trim() : '';
        if (!original) continue;

        // Ако няма сложена подсказка след тирето/запетайката, ползваме самата дума
        const hint = parts[1] && parts[1].trim() ? parts[1].trim() : original;

        if (checkDuplicate(original, addWordCategoryId.value)) {
          duplicatesCount++;
          continue;
        }

        const { error } = await supabaseClient.from('words').insert([{
          category_id: addWordCategoryId.value,
          original_word: original,
          impostor_hint: hint
        }]);

        if (!error) addedCount++;
      }

      alert(`Готово! Добавени нови думи: ${addedCount}. Пропуснати дубликати: ${duplicatesCount}.`);
      bulkWordsText.value = '';
      fetchData();
    };

    const handleFileUpload = (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        bulkWordsText.value = e.target.result;
      };
      reader.readAsText(file);
    };

    const generateWithAI = async () => {
      if (!aiTopicInput.value.trim() || !addWordCategoryId.value) {
        alert('Моля изберете категория и напишете дума/тема за генериране!');
        return;
      }

      isGenerating.value = true;
      try {
        const apiKey = 'ТВОЯТ_GEMINI_API_KEY'; 
        if (!apiKey || apiKey === 'ТВОЯТ_GEMINI_API_KEY') {
          alert('Моля въведете валиден Gemini API ключ в js/app.js');
          isGenerating.value = false;
          return;
        }

        const responseUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const prompt = `Дай ми една интересна дума на български език по темата "${aiTopicInput.value}" и една подходяща близка подсказка за играта Impostor (игра на асоциации). Върни отговора задължително в чист JSON формат без Markdown форматиране, с точно тези ключове: {"original": "...", "hint": "..."}`;

        const res = await fetch(responseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await res.json();
        const textResult = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(textResult);

        newOriginalWord.value = parsed.original;
        newImpostorHint.value = parsed.hint;
        aiTopicInput.value = '';
        alert('Успешно генерирани дума и подсказка!');
      } catch (e) {
        alert('Грешка при AI генерацията: ' + e.message);
      } finally {
        isGenerating.value = false;
      }
    };

    return {
      gameState, players, newPlayerName, impostorCount, selectedCategory,
      categories, addPlayer, removePlayer, startGame, currentTurnPlayer,
      currentPlayerIndex, isHolding, assignedRoles, nextPlayer, startingPlayer,
      resetGame, showAdminModal, isAdmin, adminEmail, adminPassword, loginAdmin,
      logoutAdmin, newCategoryName, addCategory, addWordCategoryId, newOriginalWord,
      newImpostorHint, addWord, aiTopicInput, isGenerating, generateWithAI,
      adminTab, bulkWordsText, addBulkWords, handleFileUpload
    };
  }
}).mount('#app');