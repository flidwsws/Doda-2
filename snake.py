import tkinter as tk
import random

# Настройки игры
WIDTH = 600
HEIGHT = 400
SPACE_SIZE = 20
BODY_PARTS = 3
SNAKE_COLOR = "#00FF00"
FOOD_COLOR = "#FF0000"
BACKGROUND_COLOR = "#000000"
SPEED = 100  # Чем меньше число, тем быстрее игра

class SnakeGame:
    def __init__(self):
        self.window = tk.Tk()
        self.window.title("Игра Змейка")
        self.window.resizable(False, False)

        self.score = 0
        self.direction = 'down'

        self.label = tk.Label(self.window, text="Счёт: {}".format(self.score), font=('consensus', 20))
        self.label.pack()

        self.canvas = tk.Canvas(self.window, bg=BACKGROUND_COLOR, height=HEIGHT, width=WIDTH)
        self.canvas.pack()

        self.window.update()

        # Центрирование окна на экране
        window_width = self.window.winfo_width()
        window_height = self.window.winfo_height()
        screen_width = self.window.winfo_screenwidth()
        screen_height = self.window.winfo_screenheight()

        x = int((screen_width/2) - (window_width/2))
        y = int((screen_height/2) - (window_height/2))
        self.window.geometry(f"{window_width}x{window_height}+{x}+{y}")

        # Привязка клавиш управления
        self.window.bind('<Left>', lambda event: self.change_direction('left'))
        self.window.bind('<Right>', lambda event: self.change_direction('right'))
        self.window.bind('<Up>', lambda event: self.change_direction('up'))
        self.window.bind('<Down>', lambda event: self.change_direction('down'))

        self.snake_coordinates = []
        self.squares = []

        # Создание змейки
        for i in range(0, BODY_PARTS):
            self.snake_coordinates.append([0, 0])

        for x, y in self.snake_coordinates:
            square = self.canvas.create_rectangle(x, y, x + SPACE_SIZE, y + SPACE_SIZE, fill=SNAKE_COLOR, tag="snake")
            self.squares.append(square)

        # Создание еды
        self.food_coordinates = [0, 0]
        self.create_food()

        # Старт игры
        self.next_turn()
        self.window.mainloop()

    def create_food(self):
        x = random.randint(0, int((WIDTH / SPACE_SIZE))-1) * SPACE_SIZE
        y = random.randint(0, int((HEIGHT / SPACE_SIZE))-1) * SPACE_SIZE
        self.food_coordinates = [x, y]
        self.canvas.create_oval(x, y, x + SPACE_SIZE, y + SPACE_SIZE, fill=FOOD_COLOR, tag="food")

    def next_turn(self):
        x, y = self.snake_coordinates[0]

        if self.direction == "up":
            y -= SPACE_SIZE
        elif self.direction == "down":
            y += SPACE_SIZE
        elif self.direction == "left":
            x -= SPACE_SIZE
        elif self.direction == "right":
            x += SPACE_SIZE

        self.snake_coordinates.insert(0, [x, y])
        square = self.canvas.create_rectangle(x, y, x + SPACE_SIZE, y + SPACE_SIZE, fill=SNAKE_COLOR)
        self.squares.insert(0, square)

        # Проверка, съела ли змейка еду
        if x == self.food_coordinates[0] and y == self.food_coordinates[1]:
            self.score += 1
            self.label.config(text="Счёт: {}".format(self.score))
            self.canvas.delete("food")
            self.create_food()
        else:
            del self.snake_coordinates[-1]
            self.canvas.delete(self.squares[-1])
            del self.squares[-1]

        # Проверка столкновений
        if self.check_collisions():
            self.game_over()
        else:
            self.window.after(SPEED, self.next_turn)

    def change_direction(self, new_direction):
        if new_direction == 'left' and self.direction != 'right':
            self.direction = new_direction
        elif new_direction == 'right' and self.direction != 'left':
            self.direction = new_direction
        elif new_direction == 'up' and self.direction != 'down':
            self.direction = new_direction
        elif new_direction == 'down' and self.direction != 'up':
            self.direction = new_direction

    def check_collisions(self):
        x, y = self.snake_coordinates[0]

        # Столкновение со стенами
        if x < 0 or x >= WIDTH or y < 0 or y >= HEIGHT:
            return True

        # Столкновение со своим хвостом
        for body_part in self.snake_coordinates[1:]:
            if x == body_part[0] and y == body_part[1]:
                return True

        return False

    def game_over(self):
        self.canvas.delete("all")
        self.canvas.create_text(self.canvas.winfo_width()/2, self.canvas.winfo_height()/2,
                                font=('consensus', 40), text="ИГРА ОКОНЧЕНА", fill="red", tag="gameover")

if __name__ == "__main__":
    SnakeGame()
