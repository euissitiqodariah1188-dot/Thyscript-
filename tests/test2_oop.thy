// ═══════════════════════════════════════════════════════
//  TEST 2: OOP & Classes
//  Menguji class, inheritance, method, encapsulation
// ═══════════════════════════════════════════════════════

print("=== TEST 2: OOP & CLASSES ===")

// Basic class
public class(Animal):
    const table name = "Unknown"
    const table sound = "..."
    const table legs = 4

    func speak():
        print(name + " says " + sound)
    end()

    func describe():
        print(name + " has " + legs + " legs")
    end()
end()

// Instantiate and use
const table dog = new Animal()
change(dog.name to("Rex"))
change(dog.sound to("Woof"))
dog.speak()
dog.describe()

const table cat = new Animal()
change(cat.name to("Mimi"))
change(cat.sound to("Meow"))
change(cat.legs to(4))
cat.speak()
cat.describe()

// Class with computation
public class(Calculator):
    const table memory = 0
    const table history = []

    func add(a, b):
        const table result = calculate(a + b)
        add result in history
        return result
    end()

    func subtract(a, b):
        const table result = calculate(a - b)
        add result in history
        return result
    end()

    func multiply(a, b):
        const table result = calculate(a * b)
        add result in history
        return result
    end()

    func divide(a, b):
        if(b == 0):
            print("Error: Division by zero!")
            return 0
        end()
        const table result = calculate(a / b)
        add result in history
        return result
    end()

    func storeMemory(val):
        change(memory to(val))
        print("Stored in memory: " + val)
    end()

    func recallMemory():
        return memory
    end()
end()

const table calc = new Calculator()
const table r1 = calc.add(50, 30)
print("50 + 30 = " + r1)

const table r2 = calc.multiply(12, 8)
print("12 * 8 = " + r2)

const table r3 = calc.divide(100, 4)
print("100 / 4 = " + r3)

const table r4 = calc.divide(5, 0)
print("5 / 0 = " + r4)

calc.storeMemory(42)
const table mem = calc.recallMemory()
print("Recalled memory: " + mem)

// Nested objects
public class(Person):
    const table firstName = ""
    const table lastName = ""
    const table age = 0

    func fullName():
        return firstName + " " + lastName
    end()

    func isAdult():
        return age >= 18
    end()

    func greet():
        const table name = fullName()
        if(isAdult()):
            print("Hello, " + name + "! You are an adult.")
        else:
            print("Hello, " + name + "! You are a minor.")
        end()
    end()
end()

const table p1 = new Person()
change(p1.firstName to("Budi"))
change(p1.lastName to("Santoso"))
change(p1.age to(25))
p1.greet()

const table p2 = new Person()
change(p2.firstName to("Ani"))
change(p2.lastName to("Putri"))
change(p2.age to(15))
p2.greet()

print("=== TEST 2 PASSED ===")
