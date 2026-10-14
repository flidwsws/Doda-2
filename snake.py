import pygame
import random
import sys

pygame.init()
pygame.font.init()

# Константы экрана
WIDTH, HEIGHT = 800, 600
GRID_SIZE = 20
GRID_WIDTH = WIDTH // GRID_SIZE
GRID_HEIGHT = HEIGHT // GRID_SIZE
FPS = 10

# Цвета
BLACK = (15, 15, 20)
WHITE = (240, 240, 240)
GREEN = (50, 220, 90)
RED = (230, 50, 50)
GOLD = (255, 215, 0)
BLUE = (50, 150, 255)
PURPLE = (160, 32, 240)
GRAY = (100, 100, 100)

screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Roguelike Snake")
clock = pygame.time.Clock()
font = pygame.font.SysFont("Arial", 24)
large_font = pygame.font.SysFont("Arial", 36)

class SnakeGame:
    def __init__(self):
        # Базовые свойства змейки
        self.snake = [(GRID_WIDTH // 2, GRID_HEIGHT // 2)]
        self.direction = (1, 0)
        self.grow = False
        
        # Характеристики персонажа (РПГ-элементы)
        self.max_hp = 3
        self.hp = 3
        self.gold = 0
        self.level = 1
        self.xp = 0
        self.xp_needed = 5
        
        # Перки и модификаторы
        self.shield = 0
        self.magnet_range = 1  # в клетках сетки
        self.speed_modifier = 0  # уменьшает FPS (замедление)
        
        # Объекты на карте
        self.foods = []       # список кортежей (x, y, type)
        self.enemies = []     # список кортежей (x, y, dx, dy)
        self.obstacles = []   # список кортежей (x, y)
        
        self.game_over = False
        self.in_level_up = False
        
        # Первоначальный спавн вещей
        self.spawn_food(3)
        self.spawn_obstacles()

    def spawn_food(self, count=1):
        types = ["normal", "normal", "normal", "gold", "heal"]
        for _ in range(count):
            while True:
                x = random.randint(0, GRID_WIDTH - 1)
                y = random.randint(0, GRID_HEIGHT - 1)
                if (x, y) not in self.snake and (x, y) not in [f[:2] for f in self.foods] and (x, y) not in self.obstacles:
                    f_type = random.choice(types)
                    self.foods.append((x, y, f_type))
                    break

    def spawn_obstacles(self):
        self.obstacles = []
        # Количество препятствий зависит от уровня
        num_obstacles = min(self.level * 2, 15)
        for _ in range(num_obstacles):
            while True:
                x = random.randint(0, GRID_WIDTH - 1)
                y = random.randint(0, GRID_HEIGHT - 1)
                # Не спавнить рядом с центром на старте
                if (x, y) not in self.snake and abs(x - GRID_WIDTH//2) > 3:
                    self.obstacles.append((x, y))
                    break

    def spawn_enemies(self):
        self.enemies = []
        num_enemies = min(self.level, 5)
        for _ in range(num_enemies):
            while True:
                x = random.randint(0, GRID_WIDTH - 1)
                y = random.randint(0, GRID_HEIGHT - 1)
                if (x, y) not in self.snake and (x, y) not in self.obstacles:
                    dx, dy = random.choice([(1,0), (-1,0), (0,1), (0,-1)])
                    self.enemies.append([x, y, dx, dy])
                    break

    def move_enemies(self):
        # Движение врагов каждую клетку
        for enemy in self.enemies:
            # С шансом 20% меняют направление
            if random.random() < 0.2:
                enemy[2], enemy[3] = random.choice([(1,0), (-1,0), (0,1), (0,-1)])
            
            enemy[0] = (enemy[0] + enemy[2]) % GRID_WIDTH
            enemy[1] = (enemy[1] + enemy[3]) % GRID_HEIGHT

    def handle_input(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            
            if event.type == pygame.KEYDOWN:
                if self.game_over:
                    if event.key == pygame.K_r:
                        self.__init__()
                    return
                
                if self.in_level_up:
                    if event.key in [pygame.K_1, pygame.K_2, pygame.K_3]:
                        self.apply_perk(event.key - pygame.K_0)
                    return

                if event.key == pygame.K_UP and self.direction != (0, 1):
                    self.direction = (0, -1)
                elif event.key == pygame.K_DOWN and self.direction != (0, -1):
                    self.direction = (0, 1)
                elif event.key == pygame.K_LEFT and self.direction != (1, 0):
                    self.direction = (-1, 0)
                elif event.key == pygame.K_RIGHT and self.direction != (-1, 0):
                    self.direction = (1, 0)

    def update(self):
        if self.game_over or self.in_level_up:
            return

        # Движение врагов
        self.move_enemies()

        # Рассчитываем новую голову змейки (сквозные стены)
        head_x = (self.snake[0][0] + self.direction[0]) % GRID_WIDTH
        head_y = (self.snake[0][1] + self.direction[1]) % GRID_HEIGHT
        new_head = (head_x, head_y)

        # Проверка магнита для еды
        for i, food in enumerate(self.foods):
            fx, fy, f_type = food
            if abs(head_x - fx) <= self.magnet_range and abs(head_y - fy) <= self.magnet_range:
                # Притягиваем еду (просто перемещаем в пасть, если она близко)
                if abs(head_x - fx) <= 1 and abs(head_y - fy) <= 1:
                    new_head = (fx, fy)

        # Столкновение с препятствиями или врагами
        hit_obstacle = new_head in self.obstacles
        hit_enemy = any(new_head == (e[0], e[1]) for e in self.enemies)
        hit_self = new_head in self.snake[1:]

        if hit_obstacle or hit_enemy or hit_self:
            if self.shield > 0:
                self.shield -= 1
                # Отталкиваемся назад или просто не растем
            else:
                self.hp -= 1
                if self.hp <= 0:
                    self.game_over = True
                    return
            
            # Если врезался в себя/стену — укорачиваем хвост вместо мгновенной смерти
            if len(self.snake) > 1:
                self.snake.pop()
        
        # Движение змейки
        self.snake.insert(0, new_head)

        # Проверка поедания пищи
        eaten = None
        for food in self.foods:
            if new_head == (food[0], food[1]):
                eaten = food
                break

        if eaten:
            self.foods.remove(eaten)
            self.xp += 1
            
            if eaten[2] == "gold":
                self.gold += random.randint(5, 15)
            elif eaten[2] == "heal":
                self.hp = min(self.max_hp, self.hp + 1)
            
            # Рогалик-прогрессия: Проверка уровня
            if self.xp >= self.xp_needed:
                self.trigger_level_up()
            
            self.spawn_food(1)
        else:
            if not self.grow:
                self.snake.pop()
            self.grow = False

    def trigger_level_up(self):
        self.in_level_up = True
        self.level += 1
        self.xp = 0
        self.xp_needed = int(self.xp_needed * 1.5)
        # Генерируем новые препятствия и врагов для усложнения
        self.spawn_obstacles()
        self.spawn_enemies()
        # Выбираем случайные перки для отображения
        self.current_perks = random.sample([
            "1. +1 Макс. HP (И исцеление)",
            "2. Получить Щит (Блокирует 1 удар)",
            "3. Магнит +1 клетка радиуса",
            "4. Замедлить время (-1 к скорости игры)"
        ], 3)

    def apply_perk(self, choice_idx):
        # Упрощенный выбор перка на основе нажатой клавиши 1, 2 или 3
        selected = self.current_perks[choice_idx - 1]
        if "Макс. HP" in selected:
            self.max_hp += 1
            self.hp += 1
        elif "Щит" in selected:
            self.shield += 1
        elif "Магнит" in selected:
            self.magnet_range += 1
        elif "Замедлить" in selected:
            self.speed_modifier = max(-4, self.speed_modifier - 1)
            
        self.in_level_up = False

    def draw(self):
        screen.fill(BLACK)

        # Рисуем препятствия
        for obs in self.obstacles:
            pygame.draw.rect(screen, GRAY, (obs[0]*GRID_SIZE, obs[1]*GRID_SIZE, GRID_SIZE-2, GRID_SIZE-2))

        # Рисуем врагов
        for enemy in self.enemies:
            pygame.draw.rect(screen, PURPLE, (enemy[0]*GRID_SIZE, enemy[1]*GRID_SIZE, GRID_SIZE-2, GRID_SIZE-2))

        # Рисуем еду
        for food in self.foods:
            color = GREEN if food[2] == "normal" else GOLD if food[2] == "gold" else BLUE
            pygame.draw.circle(screen, color, (food[0]*GRID_SIZE + GRID_SIZE//2, food[1]*GRID_SIZE + GRID_SIZE//2), GRID_SIZE//2 - 1)

        # Рисуем змейку
        for i, part in enumerate(self.snake):
            color = (60, 255, 100) if i == 0 else (40, 180, 70)
            # Если есть щит, подсветим голову синим
            if i == 0 and self.shield > 0:
                color = BLUE
            pygame.draw.rect(screen, color, (part[0]*GRID_SIZE, part[1]*GRID_SIZE, GRID_SIZE-2, GRID_SIZE-2))

        # Интерфейс (UI)
        hp_text = font.render(f"HP: {self.hp}/{self.max_hp}", True, RED)
        gold_text = font.render(f"Золото: {self.gold}", True, GOLD)
        lvl_text = font.render(f"Уровень: {self.level} (XP: {self.xp}/{self.xp_needed})", True, WHITE)
        shield_text = font.render(f"Щит: {self.shield}", True, BLUE)
        
        screen.blit(hp_text, (10, 10))
        screen.blit(shield_text, (150, 10))
        screen.blit(gold_text, (280, 10))
        screen.blit(lvl_text, (410, 10))

        # Экраны состояний (Level Up / Game Over)
        if self.in_level_up:
            overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            overlay.fill((0, 0, 0, 200))
            screen.blit(overlay, (0,0))
            
            title = large_font.render("НОВЫЙ УРОВЕНЬ! Выберите перк:", True, GOLD)
