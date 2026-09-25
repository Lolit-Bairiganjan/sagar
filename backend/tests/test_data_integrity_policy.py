import os
import unittest

from app import config


class TestDataIntegrityPolicy(unittest.TestCase):
    def test_default_environment_is_production(self):
        self.assertFalse(config.is_test_mode())

    def test_test_mode_can_be_enabled_explicitly(self):
        original = os.environ.get("APP_ENV")
        os.environ["APP_ENV"] = "test"
        try:
            self.assertTrue(config.is_test_mode())
        finally:
            if original is None:
                os.environ.pop("APP_ENV", None)
            else:
                os.environ["APP_ENV"] = original


if __name__ == "__main__":
    unittest.main()
