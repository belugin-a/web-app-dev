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

// Функция для отображения всех фильмов в виде таблицы (п.7)
function renderFilmsTable() {
  const tableBody = document.getElementById('filmsTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = '';

  films.forEach(film => {
    const row = document.createElement('tr');

    const titleCell = document.createElement('td');
    titleCell.textContent = film["название"];

    const genreCell = document.createElement('td');
    genreCell.textContent = film["жанр"].join(', ');

    const directorCell = document.createElement('td');
    directorCell.textContent = film["режиссер"];

    const yearCell = document.createElement('td');
    yearCell.textContent = film["год выпуска"];

    row.appendChild(titleCell);
    row.appendChild(genreCell);
    row.appendChild(directorCell);
    row.appendChild(yearCell);

    tableBody.appendChild(row);
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
});
