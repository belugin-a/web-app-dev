// Фильмотека - массив фильмов
const films = [
  {
    "название": "Метрополис",
    "жанр": ["Научная фантастика", "Антиутопия"],
    "режиссер": "Фриц Ланг",
    "год выпуска": 1927
  },
  {
    "название": "2001: Космическая одиссея",
    "жанр": ["Научная фантастика", "Эпопея"],
    "режиссер": "Стэнли Кубрик",
    "год выпуска": 1968
  },
  {
    "название": "Звёздные войны. Эпизод IV: Новая надежда",
    "жанр": ["Научная фантастика", "Космическая опера", "Приключения"],
    "режиссер": "Джордж Лукас",
    "год выпуска": 1977
  },
  {
    "название": "Чужой",
    "жанр": ["Научная фантастика", "Ужасы"],
    "режиссер": "Ридли Скотт",
    "год выпуска": 1979
  },
  {
    "название": "Бегущий по лезвию",
    "жанр": ["Научная фантастика", "Нуар", "Триллер"],
    "режиссер": "Ридли Скотт",
    "год выпуска": 1982
  },
  {
    "название": "Терминатор",
    "жанр": ["Научная фантастика", "Боевик"],
    "режиссер": "Джеймс Кэмерон",
    "год выпуска": 1984
  },
  {
    "название": "Назад в будущее",
    "жанр": ["Научная фантастика", "Комедия", "Приключения"],
    "режиссер": "Роберт Земекис",
    "год выпуска": 1985
  },
  {
    "название": "Чужие",
    "жанр": ["Научная фантастика", "Боевик", "Ужасы"],
    "режиссер": "Джеймс Кэмерон",
    "год выпуска": 1986
  },
  {
    "название": "Робокоп",
    "жанр": ["Научная фантастика", "Боевик", "Триллер"],
    "режиссер": "Пол Верховен",
    "год выпуска": 1987
  },
  {
    "название": "Терминатор 2: Судный день",
    "жанр": ["Научная фантастика", "Боевик"],
    "режиссер": "Джеймс Кэмерон",
    "год выпуска": 1991
  },
  {
    "название": "Матрица",
    "жанр": ["Научная фантастика", "Боевик"],
    "режиссер": "Лана Вачовски, Лилли Вачовски",
    "год выпуска": 1999
  },
  {
    "название": "Особое мнение",
    "жанр": ["Научная фантастика", "Триллер", "Детектив"],
    "режиссер": "Стивен Спилберг",
    "год выпуска": 2002
  },
  {
    "название": "Начало",
    "жанр": ["Научная фантастика", "Боевик", "Триллер"],
    "режиссер": "Кристофер Нолан",
    "год выпуска": 2010
  },
  {
    "название": "Гравитация",
    "жанр": ["Научная фантастика", "Триллер", "Драма"],
    "режиссер": "Альфонсо Куарон",
    "год выпуска": 2013
  },
  {
    "название": "Интерстеллар",
    "жанр": ["Научная фантастика", "Драма", "Приключения"],
    "режиссер": "Кристофер Нолан",
    "год выпуска": 2014
  }
];

// Функция для вывода названий всех фильмов, отсортированных в алфавитном порядке (п.2)
function getSortedFilmTitles(filmsArray) {
  const sorted = filmsArray.slice().sort((a, b) => {
    const titleA = a["название"].toLowerCase();
    const titleB = b["название"].toLowerCase();
    if (titleA < titleB) return -1;
    if (titleA > titleB) return 1;
    return 0;
  });

  const titles = sorted.map(film => film["название"]);
  console.log("Названия фильмов в алфавитном порядке:", titles);
  return titles;
}

// Функция для фильтрации по жанру (п.3)
// Жанр у фильма - массив, поэтому проверяем наличие указанного жанра в этом массиве
function getFilmsByGenre(filmsArray, genre) {
  const search = genre.trim().toLowerCase();

  const filtered = filmsArray.filter(film =>
    film["жанр"].some(filmGenre => filmGenre.toLowerCase() === search)
  );

  console.log(`Фильмы жанра "${genre}":`, filtered);
  return filtered;
}

// Функция для фильтрации по году выпуска (фильмы, выпущенные после указанного года) (п.4)
function getFilmsAfterYear(filmsArray, year) {
  const yearNum = Number(year);
  const filtered = filmsArray.filter(film => film["год выпуска"] > yearNum);
  console.log(`Фильмы, выпущенные после ${yearNum} года:`, filtered);
  return filtered;
}

// Функция для фильтрации по режиссеру (п.5)
function getFilmsByDirector(filmsArray, director) {
  const filtered = filmsArray.filter(film =>
    film["режиссер"].toLowerCase().includes(director.toLowerCase())
  );
  console.log(`Фильмы режиссера "${director}":`, filtered);
  return filtered;
}

// Состояние отображения таблицы: выбранные фильтры и сортировка
const viewState = {
  genre: null,        // выбранный жанр (п.3)
  director: null,     // выбранный режиссер (п.5)
  afterYear: null,    // "выпущены после года" (п.4)
  sortByTitle: false  // сортировка по названию выключена по умолчанию (п.2)
};

// Применяет выбранные фильтры и сортировку, используя готовые функции п.2-5
function applyViewState(filmsArray) {
  let result = filmsArray;

  if (viewState.genre) {
    result = getFilmsByGenre(result, viewState.genre);
  }

  if (viewState.director) {
    result = getFilmsByDirector(result, viewState.director);
  }

  if (viewState.afterYear !== null) {
    result = getFilmsAfterYear(result, viewState.afterYear);
  }

  if (viewState.sortByTitle) {
    // getSortedFilmTitles возвращает только названия,
    // поэтому восстанавливаем объекты фильмов в полученном порядке
    const sortedTitles = getSortedFilmTitles(result);
    result = sortedTitles.map(title => result.find(film => film["название"] === title));
  }

  return result;
}

// Создает чип активного фильтра
function createFilterChip(label, filterKey) {
  const chip = document.createElement('span');
  chip.className = 'filter-chip';

  const text = document.createElement('span');
  text.textContent = label;
  chip.appendChild(text);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'filter-chip-remove';
  removeBtn.setAttribute('aria-label', 'Снять фильтр: ' + label);
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', function() {
    viewState[filterKey] = null;
    if (filterKey === 'afterYear') {
      document.getElementById('yearFilter').value = '';
    }
    renderFilmsTable();
  });

  chip.appendChild(removeBtn);
  return chip;
}

// Обновляет шапку таблицы: активные фильтры, индикатор сортировки, счетчик
function updateTableHeader(totalCount, visibleCount) {
  const activeFilters = document.getElementById('activeFilters');
  const summary = document.getElementById('tableSummary');
  const sortButton = document.getElementById('sortByTitle');
  const sortIndicator = document.getElementById('sortIndicator');

  activeFilters.innerHTML = '';

  if (viewState.genre) {
    activeFilters.appendChild(createFilterChip('Жанр: ' + viewState.genre, 'genre'));
  }
  if (viewState.director) {
    activeFilters.appendChild(createFilterChip('Режиссер: ' + viewState.director, 'director'));
  }
  if (viewState.afterYear !== null) {
    activeFilters.appendChild(createFilterChip('После ' + viewState.afterYear + ' года', 'afterYear'));
  }

  activeFilters.hidden = activeFilters.children.length === 0;

  sortButton.setAttribute('aria-pressed', viewState.sortByTitle ? 'true' : 'false');
  sortButton.classList.toggle('is-active', viewState.sortByTitle);
  sortIndicator.textContent = viewState.sortByTitle ? '▲' : '⇅';

  summary.textContent = 'Показано ' + visibleCount + ' из ' + totalCount + ' фильмов';
}

// Функция для отображения фильмов в виде таблицы с учетом фильтров (п.7)
function renderFilmsTable() {
  const tableBody = document.getElementById('filmsTableBody');
  if (!tableBody) return;

  const visibleFilms = applyViewState(films);

  tableBody.innerHTML = '';

  if (visibleFilms.length === 0) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 4;
    emptyCell.className = 'empty-row';
    emptyCell.textContent = 'По выбранным условиям фильмов не найдено';
    emptyRow.appendChild(emptyCell);
    tableBody.appendChild(emptyRow);
  }

  visibleFilms.forEach(film => {
    const row = document.createElement('tr');

    const titleCell = document.createElement('td');
    titleCell.textContent = film["название"];

    const genreCell = document.createElement('td');
    genreCell.className = 'genre-cell';
    film["жанр"].forEach(genre => {
      const genreBtn = document.createElement('button');
      genreBtn.type = 'button';
      genreBtn.className = 'filter-tag';
      genreBtn.dataset.genre = genre;
      genreBtn.textContent = genre;

      if (viewState.genre === genre) {
        genreBtn.classList.add('is-active');
        genreBtn.setAttribute('aria-pressed', 'true');
      } else {
        genreBtn.setAttribute('aria-pressed', 'false');
      }

      genreCell.appendChild(genreBtn);
    });

    const directorCell = document.createElement('td');
    directorCell.className = 'director-cell';
    const directorBtn = document.createElement('button');
    directorBtn.type = 'button';
    directorBtn.className = 'filter-link';
    directorBtn.dataset.director = film["режиссер"];
    directorBtn.textContent = film["режиссер"];

    if (viewState.director === film["режиссер"]) {
      directorBtn.classList.add('is-active');
      directorBtn.setAttribute('aria-pressed', 'true');
    } else {
      directorBtn.setAttribute('aria-pressed', 'false');
    }

    directorCell.appendChild(directorBtn);

    const yearCell = document.createElement('td');
    yearCell.textContent = film["год выпуска"];

    row.appendChild(titleCell);
    row.appendChild(genreCell);
    row.appendChild(directorCell);
    row.appendChild(yearCell);

    tableBody.appendChild(row);
  });

  updateTableHeader(films.length, visibleFilms.length);
}

// Обработчики сортировки, фильтров по клику и сброса
function initTableControls() {
  const tableBody = document.getElementById('filmsTableBody');
  const sortButton = document.getElementById('sortByTitle');
  const resetButton = document.getElementById('resetFilters');
  const yearInput = document.getElementById('yearFilter');

  // Клик по жанру или режиссеру в таблице
  tableBody.addEventListener('click', function(e) {
    const genreBtn = e.target.closest('[data-genre]');
    if (genreBtn) {
      const genre = genreBtn.dataset.genre;
      viewState.genre = viewState.genre === genre ? null : genre;
      renderFilmsTable();
      return;
    }

    const directorBtn = e.target.closest('[data-director]');
    if (directorBtn) {
      const director = directorBtn.dataset.director;
      viewState.director = viewState.director === director ? null : director;
      renderFilmsTable();
    }
  });

  // Сортировка по названию: включить / выключить
  sortButton.addEventListener('click', function() {
    viewState.sortByTitle = !viewState.sortByTitle;
    renderFilmsTable();
  });

  // Фильтр "выпущены после указанного года"
  yearInput.addEventListener('input', function() {
    const value = yearInput.value.trim();
    const yearNumber = Number(value);
    viewState.afterYear = value === '' || Number.isNaN(yearNumber) ? null : yearNumber;
    renderFilmsTable();
  });

  // Сброс всех фильтров и сортировки одним действием
  resetButton.addEventListener('click', function() {
    viewState.genre = null;
    viewState.director = null;
    viewState.afterYear = null;
    viewState.sortByTitle = false;
    yearInput.value = '';
    renderFilmsTable();
  });
}

// Обработка формы добавления фильма (п.6)
function initForm() {
  const form = document.getElementById('addFilmForm');
  if (!form) return;

  form.addEventListener('submit', function(e) {
    e.preventDefault();

    const titleInput = document.getElementById('filmTitle');
    const genreInput = document.getElementById('filmGenre');
    const directorInput = document.getElementById('filmDirector');
    const yearInput = document.getElementById('filmYear');

    // Жанры вводятся через запятую, сохраняем их массивом
    const genres = genreInput.value
      .split(',')
      .map(genre => genre.trim())
      .filter(genre => genre.length > 0);

    const newFilm = {
      "название": titleInput.value.trim(),
      "жанр": genres,
      "режиссер": directorInput.value.trim(),
      "год выпуска": Number(yearInput.value)
    };

    if (newFilm["название"] && newFilm["жанр"].length > 0 && newFilm["режиссер"] && yearInput.value) {
      films.push(newFilm);
      form.reset();
      renderFilmsTable();
      console.log("Фильм добавлен:", newFilm);
    }
  });
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  renderFilmsTable();
  initForm();
  initTableControls();
});
